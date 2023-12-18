import BooxPlugin from "main";
import PBUtil from "./pb-util";

export default class SyncUtil {
	private static instance: SyncUtil;

	plugin: BooxPlugin;
	pbUtils: PBUtil;

	constructor(plugin: BooxPlugin) {
		this.plugin = plugin;
		this.pbUtils = PBUtil.getInstance(plugin);
	}

	static getInstance(plugin: BooxPlugin) {
		if (!SyncUtil.instance) {
			SyncUtil.instance = new SyncUtil(plugin);
		}
		return SyncUtil.instance;
	}

	async syncShapes(user: string, docId: string) {
		let res: any = await this.pbUtils.getNotePBFile(user, docId);
		res = await this.pbUtils.getNoteResourcePBFile(user, docId);
		return res;
	}
}
