type Opt = Record<string, unknown>;
declare const OwlGen: {
	owl(o: Opt): string;
	sleep(o?: Opt): string;
	icon(o?: Opt): string;
	animSvg(key: string, o?: Opt): string;
	STATES: Record<string, Opt>;
	ANIMS: Record<string, unknown>;
	DARK: Opt;
};
export default OwlGen;
