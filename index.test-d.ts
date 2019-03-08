import {expectType} from 'tsd-check';
import psList, {ProcessDescriptor} from '.';

const processes: ProcessDescriptor[] = await psList();
psList({all: false});

expectType<number>(processes[0].pid);
expectType<string>(processes[0].name);
expectType<number>(processes[0].ppid);
expectType<string | undefined>(processes[0].cmd);
expectType<number | undefined>(processes[0].cpu);
expectType<number | undefined>(processes[0].memory);
expectType<number | undefined>(processes[0].uid);
