import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, setIcon, Setting } from 'obsidian';
import { ThreePaneChildView, ThreePaneParentView, VIEW_TYPE_THREE_PANE_CHILD, VIEW_TYPE_THREE_PANE_PARENT } from 'Views/ThreePaneView';

interface ThreePaneSettings {
    mySetting: string;
}

const DEFAULT_SETTINGS: ThreePaneSettings = {
    mySetting: 'default'
}

export default class ThreePanePlugin extends Plugin {
    settings: ThreePaneSettings;

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_THREE_PANE_PARENT,
            (leaf) => new ThreePaneParentView(leaf)
        );

        this.addSettingTab(new ThreePaneSettingsTab(this.app, this));

        this.activateView();
    }

    async activateView() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_THREE_PANE_PARENT);

        const leaf = this.app.workspace.getLeftLeaf(false)
        await leaf.setViewState({
          type: VIEW_TYPE_THREE_PANE_PARENT,
          active: true,
        });

        this.app.workspace.revealLeaf(leaf);
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_THREE_PANE_PARENT);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class ThreePaneSettingsTab extends PluginSettingTab {
    plugin: ThreePanePlugin;

    constructor(app: App, plugin: ThreePanePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();

        containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

        new Setting(containerEl)
            .setName('Setting #1.0101')
            .setDesc('It\'s a secret')
            .addText(text => text
                .setPlaceholder('Enter your secret')
                .setValue(this.plugin.settings.mySetting)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.settings.mySetting = value;
                    await this.plugin.saveSettings();
                }));
    }
}
