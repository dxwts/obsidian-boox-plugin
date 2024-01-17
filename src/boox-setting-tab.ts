import BooxPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export class BooxSettingTab extends PluginSettingTab {
	plugin: BooxPlugin;

	constructor(app: App, plugin: BooxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "BOOX" });

		new Setting(containerEl)
			.setName("Access Token")
			.setDesc("请填写BOOX平台的AccessToken")
			.addText((text) =>
				text
					.setPlaceholder("Enter your accessToken")
					.setValue(this.plugin.settings.accessToken)
					.onChange(async (value) => {
						this.plugin.settings.accessToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("服务器选择")
			.setDesc("请选择服务器")
			.addDropdown((dropdown) => {
				dropdown
					.addOption(
						"https://dev.send2boox.com",
						"https://dev.send2boox.com"
					)
					.addOption("https://send2boox.com", "https://send2boox.com")
					.addOption("https://push.boox.com", "https://push.boox.com")
					.addOption("https://eur.boox.com", "https://eur.boox.com")
					.setValue(this.plugin.settings.server)
					.onChange(async (value) => {
						this.plugin.settings.server = value;
						this.plugin.boox.doAction("changeService", value);
						await this.plugin.saveSettings();
					});
			});

		// 开启关闭同步设置
		new Setting(containerEl)
			.setName("开启关闭同步设置")
			.setDesc("开启关闭同步设置")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.syncEnabled)
					.onChange(async (value) => {
						value
							? this.plugin.boox.doAction("syncState", "CHANGED")
							: this.plugin.boox.doAction(
									"syncState",
									"UNCHANGED"
							  );
						this.plugin.boox.doAction("syncEnabled", value);
						this.plugin.settings.syncEnabled = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
