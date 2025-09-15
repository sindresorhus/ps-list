import process from 'node:process';
import fs from 'node:fs';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import childProcess from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_MAX_BUFFER = 64_000_000; // 64 MB
const MAXIMUM_PATH_COMBINATION_ATTEMPTS = 6; // Limit path parsing attempts for performance

const execFile = promisify(childProcess.execFile);

// Process list field names (used in ps command output)
const PROCESS_FIELDS = {
	CPU_PERCENT: '%cpu',
	MEMORY_PERCENT: '%mem',
	PROCESS_ID: 'pid',
	PARENT_PROCESS_ID: 'ppid',
	USER_ID: 'uid',
	START_TIME: 'lstart',
	COMMAND_NAME: 'comm',
	ARGUMENTS: 'args',
};

// Helper to build ps command flags consistently
const buildProcessCommandFlags = includeAllUsersProcesses => (includeAllUsersProcesses === false ? '' : 'a') + 'wwxo';

// Safe Date parsing with validation
const makeStartTime = startTimeString => {
	if (!startTimeString) {
		return undefined;
	}

	const parsedDate = new Date(startTimeString);
	return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

// Extract executable path from command line using filesystem validation only
const extractExecutablePath = commandLine => {
	if (!commandLine) {
		return '';
	}

	// Skip non-path commands (no filesystem validation possible)
	if (!commandLine.startsWith('/') && !commandLine.startsWith('"')) {
		return '';
	}

	// Handle quoted paths first: "/path with spaces/executable"
	if (commandLine.startsWith('"')) {
		const quotedPathMatch = commandLine.match(/^"([^"]+)"/);
		if (quotedPathMatch && fs.existsSync(quotedPathMatch[1])) {
			return quotedPathMatch[1];
		}

		return '';
	}

	// For unquoted absolute paths, try different strategies
	const commandParts = commandLine.split(' ');

	// Strategy 1: Simple first token (most common case)
	const firstCommandToken = commandParts[0];
	if (fs.existsSync(firstCommandToken)) {
		return firstCommandToken;
	}

	// Strategy 2: Progressive combination for paths with spaces
	// Limit to reasonable number of attempts for performance
	const maximumCombinationAttempts = Math.min(commandParts.length, MAXIMUM_PATH_COMBINATION_ATTEMPTS);
	for (let tokenCount = 2; tokenCount <= maximumCombinationAttempts; tokenCount++) {
		const candidateExecutablePath = commandParts.slice(0, tokenCount).join(' ');
		if (fs.existsSync(candidateExecutablePath)) {
			return candidateExecutablePath;
		}
	}

	return '';
};

// Resolve executable path - simple approach
const resolveExecutablePath = (operatingSystemPlatform, processId, commandLine) => {
	// On Linux, try /proc/{pid}/exe first for accurate path
	if (operatingSystemPlatform === 'linux' && processId) {
		try {
			const symbolicLink = fs.readlinkSync(`/proc/${processId}/exe`);
			return symbolicLink.replace(/\s+\(deleted\)$/, '');
		} catch {
			// Continue to other methods
		}
	}

	// Extract path from command line
	return extractExecutablePath(commandLine);
};

// Parse and validate numeric field with fallback
const parseNumericField = (fieldValue, parserFunction = Number.parseInt, defaultValue = 0) => {
	if (!fieldValue) {
		return defaultValue;
	}

	const parsedValue = parserFunction(fieldValue, 10);
	return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
};

// Parse integer or return undefined - used for uid to avoid conflating unknown with root (0)
const parseIntegerOrUndefined = fieldValue => {
	if (fieldValue === undefined || fieldValue === '') {
		return undefined;
	}

	const parsedValue = Number.parseInt(fieldValue, 10);
	return Number.isNaN(parsedValue) ? undefined : parsedValue;
};

// Unified field parser
const parseProcessFields = ({processId, parentProcessId, userId, cpuUsage, memoryUsage, commandName, startTimeString, command}) => {
	// Parse numeric fields with proper defaults
	const parsedProcessId = parseNumericField(processId);
	const parsedParentProcessId = parseNumericField(parentProcessId);
	const parsedUserId = parseIntegerOrUndefined(userId);
	const parsedCpuUsagePercentage = parseNumericField(cpuUsage, Number.parseFloat);
	const parsedMemoryUsagePercentage = parseNumericField(memoryUsage, Number.parseFloat);

	// Resolve executable path from command line
	const resolvedExecutablePath = resolveExecutablePath(process.platform, parsedProcessId, command);

	// Derive process name: prefer basename of path, fallback to command name
	const derivedProcessName = resolvedExecutablePath ? path.basename(resolvedExecutablePath) : (commandName || '');

	return {
		pid: parsedProcessId,
		ppid: parsedParentProcessId,
		uid: parsedUserId, // Undefined when uid can't be parsed (avoid conflating with root)
		cpu: parsedCpuUsagePercentage,
		memory: parsedMemoryUsagePercentage,
		name: derivedProcessName,
		path: resolvedExecutablePath,
		startTime: makeStartTime(startTimeString),
		cmd: command || '',
	};
};

const windows = async () => {
	// Source: https://github.com/MarkTiedemann/fastlist
	let binary;
	switch (process.arch) {
		case 'x64': {
			binary = 'fastlist-0.3.0-x64.exe';
			break;
		}

		case 'ia32': {
			binary = 'fastlist-0.3.0-x86.exe';
			break;
		}

		case 'arm64': {
			throw new Error('Windows ARM64 is not supported yet.');
		}

		default: {
			throw new Error(`Unsupported architecture: ${process.arch}`);
		}
	}

	const binaryPath = path.join(__dirname, 'vendor', binary);
	const {stdout} = await execFile(binaryPath, {
		maxBuffer: DEFAULT_MAX_BUFFER,
		windowsHide: true,
		encoding: 'utf8',
	});

	return stdout
		.trim()
		.split(/\r?\n/)
		.map(line => line.split('\t'))
		.map(([processId, parentProcessId, processName]) => ({
			pid: Number.parseInt(processId, 10),
			ppid: Number.parseInt(parentProcessId, 10),
			name: processName,
		}));
};

// Fallback implementation with multiple ps calls
const nonWindowsFallbackMultipleCalls = async (options = {}) => {
	const processDataByProcessId = {};
	const processCommandFlags = buildProcessCommandFlags(options.all);

	const fields = [
		PROCESS_FIELDS.COMMAND_NAME,
		PROCESS_FIELDS.ARGUMENTS,
		PROCESS_FIELDS.PARENT_PROCESS_ID,
		PROCESS_FIELDS.USER_ID,
		PROCESS_FIELDS.CPU_PERCENT,
		PROCESS_FIELDS.MEMORY_PERCENT,
		PROCESS_FIELDS.START_TIME,
	];

	await Promise.all(fields.map(async fieldName => {
		// Use headerless output with = syntax
		const {stdout} = await execFile('ps', [processCommandFlags, `${PROCESS_FIELDS.PROCESS_ID}=,${fieldName}=`], {
			maxBuffer: DEFAULT_MAX_BUFFER,
			encoding: 'utf8',
			env: {
				...process.env,
				LC_ALL: 'C',
				LANG: 'C',
			},
		});

		for (const line of stdout.trim().split('\n')) {
			const trimmedLine = line.trim();
			const spaceIndex = trimmedLine.indexOf(' ');
			if (spaceIndex === -1) {
				// No space found - treat entire line as processId with empty field value
				const processId = trimmedLine;
				const fieldValue = '';
				processDataByProcessId[processId] ??= {};
				processDataByProcessId[processId][fieldName] = fieldValue;
				continue;
			}

			const processId = trimmedLine.slice(0, spaceIndex);
			const fieldValue = trimmedLine.slice(spaceIndex + 1).trim();

			processDataByProcessId[processId] ??= {};
			processDataByProcessId[processId][fieldName] = fieldValue;
		}
	}));

	// Filter out incomplete entries and convert to process objects
	return Object.entries(processDataByProcessId)
		.filter(([, data]) => data[PROCESS_FIELDS.COMMAND_NAME] && data[PROCESS_FIELDS.PARENT_PROCESS_ID] !== undefined)
		.map(([processId, data]) => parseProcessFields({
			processId,
			parentProcessId: data[PROCESS_FIELDS.PARENT_PROCESS_ID],
			userId: data[PROCESS_FIELDS.USER_ID],
			cpuUsage: data[PROCESS_FIELDS.CPU_PERCENT],
			memoryUsage: data[PROCESS_FIELDS.MEMORY_PERCENT],
			commandName: data[PROCESS_FIELDS.COMMAND_NAME],
			startTimeString: data[PROCESS_FIELDS.START_TIME],
			command: data[PROCESS_FIELDS.ARGUMENTS] ?? '',
		}));
};

// Main implementation with headerless output and simpler parsing
const nonWindowsCall = async (options = {}) => {
	const processCommandFlags = buildProcessCommandFlags(options.all);

	// Common execFile options to avoid duplication
	const executeFileOptions = {
		maxBuffer: DEFAULT_MAX_BUFFER,
		encoding: 'utf8',
		env: {
			...process.env,
			LC_ALL: 'C',
			LANG: 'C',
		},
	};

	// Build field lists for ps commands
	const processFieldCommaSeparatedList = [
		PROCESS_FIELDS.PROCESS_ID,
		PROCESS_FIELDS.PARENT_PROCESS_ID,
		PROCESS_FIELDS.USER_ID,
		PROCESS_FIELDS.CPU_PERCENT,
		PROCESS_FIELDS.MEMORY_PERCENT,
		PROCESS_FIELDS.START_TIME,
		PROCESS_FIELDS.COMMAND_NAME,
	].map(fieldName => `${fieldName}=`).join(',');

	const commandFieldCommaSeparatedList = [
		PROCESS_FIELDS.PROCESS_ID,
		PROCESS_FIELDS.ARGUMENTS,
	].map(fieldName => `${fieldName}=`).join(',');

	// Use headerless output with = syntax for consistent parsing
	const processListingPromises = [
		execFile('ps', [processCommandFlags, processFieldCommaSeparatedList], executeFileOptions),
		execFile('ps', [processCommandFlags, commandFieldCommaSeparatedList], executeFileOptions),
	];

	const [processOutput, commandOutput] = await Promise.all(processListingPromises);
	const processLines = processOutput.stdout.trim().split('\n');
	const commandLines = commandOutput.stdout.trim().split('\n');

	// Build command lookup map
	const commandLinesByProcessId = {};
	for (const line of commandLines) {
		const trimmedLine = line.trim();
		const spaceIndex = trimmedLine.indexOf(' ');
		if (spaceIndex === -1) {
			// No space found - treat entire line as processId with empty command
			const processId = trimmedLine;
			commandLinesByProcessId[processId] = '';
			continue;
		}

		const processId = trimmedLine.slice(0, spaceIndex);
		const command = trimmedLine.slice(spaceIndex + 1).trim();
		commandLinesByProcessId[processId] = command;
	}

	// Parse process lines - format: pid ppid uid cpu mem lstart comm
	const processes = [];
	for (const line of processLines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) {
			continue;
		}

		// Parse fixed-width fields more carefully
		// Format: "pid ppid uid cpu mem Day Mon DD HH:MM:SS YYYY comm"
		// First 5 fields should be numeric values (pid, ppid, uid are integers; cpu, memory are floats)
		// Regex breakdown: ^(\d+) = pid, \s+(\d+) = ppid, \s+(\d+) = uid, \s+([\d.]+) = cpu%, \s+([\d.]+) = mem%, \s+(.+) = rest
		const processLineRegexMatch = trimmedLine.match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+)/);
		if (!processLineRegexMatch) {
			continue;
		}

		const [, processId, parentProcessId, userId, cpuUsage, memoryUsage, dateAndCommandPortion] = processLineRegexMatch;

		// Parse lstart from dateAndCommandPortion - it's always: "Day Mon DD HH:MM:SS YYYY"
		// This regex handles both single and double digit days
		// Regex breakdown: ((?:\w{3}\s+){2} = "Day Mon ", \d{1,2} = day, \s+(?:\d{2}:){2}\d{2} = "HH:MM:SS", \s+\d{4}) = " YYYY"
		const startTimeRegexMatch = dateAndCommandPortion.match(/^((?:\w{3}\s+){2}\d{1,2}\s+(?:\d{2}:){2}\d{2}\s+\d{4})\s+(.*)$/);

		let startTimeString = '';
		let processCommandName = dateAndCommandPortion; // Fallback if start time parsing fails

		if (startTimeRegexMatch) {
			startTimeString = startTimeRegexMatch[1];
			processCommandName = startTimeRegexMatch[2] || '';
		}

		processes.push(parseProcessFields({
			processId,
			parentProcessId,
			userId,
			cpuUsage,
			memoryUsage,
			commandName: processCommandName,
			startTimeString,
			command: commandLinesByProcessId[processId] ?? '',
		}));
	}

	return processes;
};

const nonWindows = async (options = {}) => {
	try {
		return await nonWindowsCall(options);
	} catch {
		// Fallback to multiple calls if main approach fails
		return nonWindowsFallbackMultipleCalls(options);
	}
};

const psList = process.platform === 'win32' ? windows : nonWindows;

export default psList;
