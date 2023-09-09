import { App, EventRef, Modal, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { LibraryView, VIEW_TYPE_LIBRARY, EventHandler } from 'src/Views/LibraryView';
import { SortSpec } from "src/SortSpec";
import { v4 as uuid } from 'uuid';


interface LibraryData {
    ids: { [key: string]: string }
    sortIndices: { [key: string]: { [key in 'notes' | 'folders']: SortIndex } }
    settings: LibrarySettings
}
interface SortIndex {
    [key: string]: number
}

const DEFAULT_CACHE: LibraryData = {
    ids: {},
    sortIndices: {},
    settings: {
        currentPath: '/'
    },
}

interface LibrarySettings {
	currentPath: string;
}

export default class LibraryPlugin extends Plugin {
    data: LibraryData
    metadataEvents: EventRef[] = []
    vaultEvents: EventRef[] = []
    events: EventHandler[] = []

    async onload() {
        console.log('*************************** Starting Library Plugin ***************************')
        await this.loadLibraryData()

        this.addSettingTab(new LibrarySettingsTab(this.app, this))

        this.app.workspace.onLayoutReady(async () => {
            this.activateView()
        })

        this.metadataEvents.push(this.app.metadataCache.on('changed', async (file, _, metadata) => {
            // Get ID from frontmatter; if it's there, store it to the cache
            const id = metadata.frontmatter?.uid
            if (id) {
                this.data.ids[file.path] = id
            }

            // If the parent folder has already been processed, skip it
            if (file.parent && this.data.ids[file.parent.path]) { return }
            const parent = file.parent as TFolder

            // Store the folder ID in the cache
            let spec = await this.getSortSpec(parent)
            this.data.ids[parent.path] = spec.id

            // Cache sort index
            let sortIndices = {folders: {} as SortIndex, notes: {} as SortIndex}
            this.data.sortIndices[spec.id] = sortIndices
            spec.folders.items.forEach((item, index) => {
                sortIndices.folders[item] = index
            })
            spec.notes.items.forEach((item, index) => {
                sortIndices.notes[item] = index
            })

            // Write all of that to disk
            this.saveLibraryData()
        }))
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIBRARY);
        this.metadataEvents.forEach((ref) => {
            this.app.metadataCache.offref(ref);
        })
        this.vaultEvents.forEach((ref) => {
            this.app.vault.offref(ref);
        })
        this.events.forEach((handler) => {
            handler.element.removeEventListener(handler.name, handler.fn)
        })
        this.saveLibraryData();
    }

    async activateView() {
        // For some reason this all gets called twice, but it doesn't seem to cause any problems.
        this.registerView(
            VIEW_TYPE_LIBRARY,
            (leaf) => {
                return new LibraryView(leaf, this)
            }
        );    
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_LIBRARY);
        const leaf = this.app.workspace.getLeftLeaf(false)
        await leaf.setViewState({
            type: VIEW_TYPE_LIBRARY,
            active: true,
        });
        this.app.workspace.revealLeaf(leaf);
    } 

	async loadLibraryData() {
		this.data = Object.assign({}, DEFAULT_CACHE, await this.loadData());
	}

	async saveLibraryData() {
		await this.saveData(this.data);
	}

    // Helpers
    async getSortSpec(folder: TFolder): Promise<SortSpec> {
        let specPath = `${folder.path}/.obsidian-folder`
        if (!await folder.vault.adapter.exists(specPath)) {
            // Create empty spec if it doesn't exist
            const spec: SortSpec = {
                id: uuid(),
                folders: { sort: 'title', direction: 'ascending', items: [] },
                notes: { sort: 'title', direction: 'ascending', items: [] }
            }
            await folder.vault.adapter.write(specPath, stringifyYaml(spec))
            return spec
        }
        const text = await folder.vault.adapter.read(specPath)
        return parseYaml(text) as SortSpec
    }

    // Gets the sort index for the given folder from the cache
    getCachedNotesSortIndex(folder: TFolder): SortIndex {
        return this.data.sortIndices[this.data.ids[folder.path]].notes
    }
    // The opposite of the above; stores to cache and disk
    async persistNotesSortIndex(folder: TFolder, sortIndex: SortIndex) {
        this.data.sortIndices[this.data.ids[folder.path]].notes = sortIndex

        const spec = await this.getSortSpec(folder)
        spec.notes.items = Object.entries(sortIndex).sort((a, b) => a[1] - b[1]).map((item) => item[0])
        await folder.vault.adapter.write(`${folder.path}/.obsidian-folder`, stringifyYaml(spec))
        await this.saveLibraryData()
    }
    getId(item: TAbstractFile) {
        return this.data.ids[item.path]
    }
    getNoteSortOrder(file: TFile): number | null {
        const parent = file.parent as TFolder
        const parentId = this.getId(parent)
        const fileId = this.getId(file)
        return this.data.sortIndices[parentId].notes[fileId]
    }
    setNoteSortOrder(file: TFile, order: number): void {
        const parent = file.parent as TFolder
        const parentId = this.getId(parent)
        const fileId = this.getId(file)
        this.data.sortIndices[parentId].notes[fileId] = order
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
                .setValue(this.plugin.data.settings.currentPath)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.data.settings.currentPath = value;
                    await this.plugin.saveLibraryData();
                }));
    }
}

/**
 * TODO:
 * Update notes list when new note is created, deleted, or moved
 * Add sorting options to notes list
 * Undo/redo
 * Handle scenario of previously un-sorted notes (create them when expected and not found)
 */
