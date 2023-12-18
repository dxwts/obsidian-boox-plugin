import axios from "axios";
import BooxPlugin from "main";

export default class Api {
	private static instance: Api;

	BASE_URL = "";
	api: any;
	plugin: BooxPlugin;

	constructor(plugin: BooxPlugin) {
		this.plugin = plugin;
		this.BASE_URL = plugin.settings.server + "/api/1";
		this.api = axios.create({
			baseURL: this.BASE_URL,
			timeout: 1000 * 30,
		});
	}

	static getInstance(plugin: BooxPlugin) {
		if (!Api.instance) {
			Api.instance = new Api(plugin);
		}
		return Api.instance;
	}

	setInterceptor(plugin: BooxPlugin) {
		this.api.interceptors.request.use(
			(config) => {
				const token = plugin.settings.token;
				if (token) {
					config.headers["Authorization"] = `Bearer ${token}`;
				}

				const accessToken = plugin.settings.accessToken;
				if (accessToken) {
					config.headers["access-token"] = accessToken;
				}
				return config;
			},
			(error) => {
				return Promise.reject(error);
			}
		);
	}

	// 获取token
	async getToken() {
		const res = await this.api.get("/users/getTokenByAccessToken");
		return res.data;
	}

	// 获取sts token
	async getStsToken() {
		const res = await this.api.get("config/stss");
		return res.data;
	}

	async getBuckets() {
		const res = await this.api.get("/config/buckets");
		return res.data;
	}

	// 获取用户信息
	async getUserInfo() {
		const res = await this.api.get("/users/me");
		return res.data;
	}

	//获取同步token
	async getSyncToken() {
		const res = await this.api.get("/users/syncToken");
		return res.data;
	}
}
