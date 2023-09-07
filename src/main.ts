import { App, Modal, Plugin, PluginSettingTab, Setting, TAbstractFile, TFolder } from 'obsidian';
import { LibraryView, VIEW_TYPE_LIBRARY, EventHandler } from 'src/Views/LibraryView';
import { SortSpec } from "src/SortSpec";
import * as yaml from 'yaml'


interface LibraryData {
    ids: { [key: string]: string }
    manualSortIndices: { [key: string]: { [key in 'notes' | 'folders']: ManualSortIndex } }
    settings: LibrarySettings
}
interface ManualSortIndex {
    [key: string]: number
}

const DEFAULT_CACHE: LibraryData = {
    ids: {},
    manualSortIndices: {},
    settings: {
        currentPath: '/'
    },
}

interface LibrarySettings {
	currentPath: string;
}

export default class LibraryPlugin extends Plugin {
    libraryData: LibraryData
    eventRefs: any[] = []
    eventHandlers: EventHandler[] = []

    async onload() {
        console.log('*************************** Starting Library Plugin ***************************')
        await this.loadLibraryData()

        this.registerView(
            VIEW_TYPE_LIBRARY,
            (leaf) => new LibraryView(leaf, this)
        );

        this.addSettingTab(new LibrarySettingsTab(this.app, this))

        this.activateView()

        this.eventRefs.push(this.app.metadataCache.on('changed', async (file, _, metadata) => {
            const id = metadata.frontmatter?.uid
            if (id) {
                this.libraryData.ids[file.path] = id
            }

            if (file.parent && this.libraryData.ids[file.parent.path]) { return }
            const parent = file.parent as TFolder

            let spec = await this.getSortSpec(parent)
            if (!spec) { return }
            this.libraryData.ids[parent.path] = spec.id

            // Cache manual sort index
            let manualSortIndex = {folders: {} as ManualSortIndex, notes: {} as ManualSortIndex}
            this.libraryData.manualSortIndices[spec.id] = manualSortIndex
            spec.folders.items.forEach((item, index) => {
                manualSortIndex.folders[item] = index
            })
            spec.notes.items.forEach((item, index) => {
                manualSortIndex.notes[item] = index
            })
            this.saveLibraryData()
        }))

        function handleDelete(abstractFile: TAbstractFile, movedFromPath: string | void) {
            if (movedFromPath) {
                console.log('moved from:', movedFromPath)
            }
            else {
                console.log('deleted:', abstractFile.path)
            }
        }

        this.eventRefs.push(this.app.vault.on('rename', handleDelete))
        this.eventRefs.push(this.app.vault.on('delete', handleDelete))
    }

    async getSortSpec(folder: TFolder): Promise<SortSpec | null> {
        let specPath = `${folder.path}/.obsidian-folder`
        if (!await folder.vault.adapter.exists(specPath)) { return null }
        const text = await folder.vault.adapter.read(specPath)
        return yaml.parse(text) as SortSpec
    }

    async activateView() {  // Library
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIBRARY);

        const leaf = this.app.workspace.getLeftLeaf(false)
        await leaf.setViewState({
            type: VIEW_TYPE_LIBRARY,
            active: true,
        });

        this.app.workspace.revealLeaf(leaf);
    } 

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIBRARY);
        this.eventRefs.forEach((ref) => {
            this.app.metadataCache.offref(ref);
        })
        this.eventHandlers.forEach((handler) => {
            handler.element.removeEventListener(handler.name, handler.fn)
        })
        this.saveLibraryData();
    }

	async loadLibraryData() {
		this.libraryData = Object.assign({}, DEFAULT_CACHE, await this.loadData());
	}

	async saveLibraryData() {
		await this.saveData(this.libraryData);
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

class LibrarySettingsTab extends PluginSettingTab {
    plugin: LibraryPlugin;

    constructor(app: App, plugin: LibraryPlugin) {
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
                .setValue(this.plugin.libraryData.settings.currentPath)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.libraryData.settings.currentPath = value;
                    await this.plugin.saveLibraryData();
                }));
    }
}

// To do:
// * Update notes list when new note is created, deleted, or moved
// * Add sorting options to notes list
// * Fix errors in console
// * Allow user to drag notes to reorder them
