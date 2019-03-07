export interface Options {
	/**
	 * Return other users' processes as well as your own.
	 *
	 * On Windows this has no effect and will always be the users' own processes.
	 *
	 * @default true
	 */
	readonly all?: boolean;
}

export interface ProcessDescriptor {
	pid: number;
	name: string;
	ppid: number;

	/**
	 * Not supported on Windows.
	 */
	cmd?: string;

	/**
	 * Not supported on Windows.
	 */
	cpu?: number;

	/**
	 * Not supported on Windows.
	 */
	memory?: number;

	/**
	 * Not supported on Windows.
	 */
	uid?: number;
}

/**
 * Get running processes.
 *
 * @returns A `Promise` that resolves to the list of running processes.
 */
export default function psList(options?: Options): Promise<ProcessDescriptor[]>;
