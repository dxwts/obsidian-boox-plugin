import OSS from "ali-oss";
import BooxPlugin from "main";
import Api from "src/api";

export default class OssUtil {
	private static instance: OssUtil;

	api: any;
	oss: any;
	plugin: any;

	constructor(plugin: BooxPlugin) {
		this.plugin = plugin;
		this.api = Api.getInstance(plugin);
	}

	static getInstance(plugin: BooxPlugin) {
		if (!OssUtil.instance) {
			OssUtil.instance = new OssUtil(plugin);
		}
		return OssUtil.instance;
	}
	async init() {
		if (this.oss) {
			return;
		}
		const buckets = await this.api.getBuckets();
		const config = await this.api.getStsToken();

		const { region, bucket } = buckets.data["onyx-cloud"];
		const opts = {
			region: region,
			accessKeyId: config.data.AccessKeyId,
			accessKeySecret: config.data.AccessKeySecret,
			stsToken: config.data.SecurityToken,
			bucket: bucket,
			refreshSTSTokenInterval: 1000 * 60 * 10,
			refreshSTSToken: async () => {
				const config = await this.api.getStsToken();
				return {
					accessKeyId: config.data.AccessKeyId,
					accessKeySecret: config.data.AccessKeySecret,
					stsToken: config.data.SecurityToken,
				};
			},
		};
		this.oss = new OSS(opts);
	}

	getClient() {
		return this.oss;
	}

	async listFile(dir: string) {
		let keys: any = [];
		let isTruncated = false;
		let nextContinuationToken = null;
		try {
			do {
				const opts: any = {
					"max-keys": 1000,
					prefix: dir,
				};
				if (nextContinuationToken) {
					opts["continuation-token"] = nextContinuationToken;
				}
				let result = await this.oss.listV2(opts);
				isTruncated = result.isTruncated;
				nextContinuationToken = result.nextContinuationToken;
				if (result.keyCount) {
					result = result.objects.map((item: any) => {
						return item.name;
					});
					keys = [...keys, ...result];
				}
			} while (isTruncated);

			return keys;
		} catch (error) {
			console.error(error);
		}
		return keys;
	}

	async fetchFileData(key: string) {
		try {
			const result = await this.oss.get(key);
			return result;
		} catch (error) {
			console.error(error);
		}
		return null;
	}

	async headFile(key: string) {
		try {
			const res = await this.oss.head(key);
			return res && res.status === 200 ? true : false;
		} catch (error) {
			return false;
		}
	}

	async getResourceUrl(key: string) {
		try {
			const res = await this.oss.signatureUrl(key);
			return res;
		} catch (error) {
			return null;
		}
	}
}
