import { App, EventRef, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { LibraryView, VIEW_TYPE_LIBRARY, EventHandler, UpdateHandler } from 'src/Views/LibraryView';
import { ObsidianFolderSpec as ObsidianFolderSpec } from "src/ObsidianFolderSpec";


interface LibraryData {
    sortCache: { [key: string]: { [key in 'notes' | 'folders']: SortIndex } }
    settings: LibrarySettings
}
interface SortIndex {
    [key: string]: number
}

const DEFAULT_CACHE: LibraryData = {
    sortCache: {},
    settings: {
        currentPath: '/'
    },
}
TFile.prototype.getParent = function(): TFolder {
    return this.parent ?? this.vault.getRoot() as TFolder
}

interface LibrarySettings {
	currentPath: string;
}

export default class LibraryPlugin extends Plugin {
    data: LibraryData
    metadataEvents: EventRef[] = []
    vaultEvents: EventRef[] = []
    events: EventHandler[] = []
    updateHandler: UpdateHandler = (_) => {}

    async onload() {
        console.log('*************************** Starting Library Plugin ***************************')
        await this.loadLibraryData()

        this.addSettingTab(new LibrarySettingsTab(this.app, this))

        this.metadataEvents.push(this.app.metadataCache.on('changed', async (file, _, metadata) => {
            // console.log('metadata changed:', file, metadata)
            // Cache parent folder if it hasn't been already
            let parent = file.getParent()
            if (this.data.sortCache[parent.path]) { return }

            // Reset cache
            this.data.sortCache[parent.path] = {folders: {} as SortIndex, notes: {} as SortIndex}
            await this.cacheFolder(parent)
        }))

        this.app.workspace.onLayoutReady(async () => {
            this.activateView()

            this.vaultEvents.push(this.app.vault.on('create', async (file) => {
                if (!(file instanceof TFile)) { return }
                const parent = file.getParent()

                // Add new note to folder spec
                let spec = await this.getOrCreateFolderSpec(parent)
                spec.sort.notes.items.push(file.name)
                this.saveFolderSpec(parent, spec)

                // Update cache (it'll read from the spec that was just updated)
                await this.cacheFolder(parent)

                this.updateHandler(file, parent)
            }))

            this.vaultEvents.push(this.app.vault.on('modify', async (file) => {
                if (!(file instanceof TFile)) { return }
                this.updateHandler(file, file.getParent())
            }))

            this.vaultEvents.push(this.app.vault.on('rename', async (file, oldPath) => {
                if (!(file instanceof TFile)) { return }
                const parent = file.getParent()
                const oldName = oldPath.split('/').pop() as string

                // Update order in folder spec
                this.data.sortCache[parent.path].notes[file.name] = this.data.sortCache[parent.path].notes[oldName]
                delete this.data.sortCache[parent.path].notes[oldName]
                this.saveLibraryData()
                this.updateSpecSortOrder(parent)

                this.updateHandler(file, parent)
            }))

            this.vaultEvents.push(this.app.vault.on('delete', async (file) => {
                if (!(file instanceof TFile)) { return }
                const parentPath = file.path.split('/').slice(0, -1).join('/')
                const parent = this.app.vault.getAbstractFileByPath(parentPath) as TFolder

                // Update order in folder spec
                delete this.data.sortCache[parent.path].notes[file.name]
                this.saveLibraryData()
                this.updateSpecSortOrder(parent)

                this.updateHandler(file, parent)
            }))
        })
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

    handleUpdates(handler: UpdateHandler) {
        this.updateHandler = handler
    }

    /**
     * Caches sort order from spec; has the side effect of creating
     * an .obsidian-library file if missing.
     * @param file File to cache
     */
    async cacheFolder(folder: TFolder) {
        let sortCache = this.data.sortCache[folder.path]
        let spec = await this.getOrCreateFolderSpec(folder)

        spec.sort.folders.items.forEach((item, index) => {
            sortCache.folders[item] = index
        })
        spec.sort.notes.items.forEach((item, index) => {
            sortCache.notes[item] = index
        })

        folder.children.forEach((abstractFile) => {
            if (abstractFile instanceof TFile && !sortCache.notes.hasOwnProperty(abstractFile.name)) {
                sortCache.notes[abstractFile.name] = Object.keys(sortCache.notes).length
            }
            else if (abstractFile instanceof TFolder && !sortCache.folders.hasOwnProperty(abstractFile.name)) {
                sortCache.folders[abstractFile.name] = Object.keys(sortCache.folders).length               
            }
        })

        this.saveLibraryData()
    }

	async loadLibraryData() {
		this.data = Object.assign({}, DEFAULT_CACHE, await this.loadData());
	}

	async saveLibraryData() {
		await this.saveData(this.data);
	}

    // Helpers
    /**
     * Side effect: creates new spec if missing
     * @param folder 
     * @returns Promise to a folder spec
     */
    async getOrCreateFolderSpec(folder: TFolder): Promise<ObsidianFolderSpec> {
        let specPath = `${folder.path}/.obsidian-library`
        let spec: ObsidianFolderSpec
        const emptySpec: ObsidianFolderSpec = {
            sort: {
                folders: { field: 'title', direction: 'ascending', items: [] },
                notes: { field: 'title', direction: 'ascending', items: [] }
            }
        }

        if (await folder.vault.adapter.exists(specPath)) {
            const text = await folder.vault.adapter.read(specPath)
            spec = parseYaml(text) as ObsidianFolderSpec
            // Make sure it's well-formed
            if (!spec.sort) spec.sort = emptySpec.sort
            if (!spec.sort.folders) spec.sort.folders = emptySpec.sort.folders
            if (!spec.sort.notes) spec.sort.notes = emptySpec.sort.notes
        }
        else spec = emptySpec
        
        await folder.vault.adapter.write(specPath, stringifyYaml(spec))
        return spec
    }
    async saveFolderSpec(folder: TFolder, spec: ObsidianFolderSpec) {
        await folder.vault.adapter.write(`${folder.path}/.obsidian-library`, stringifyYaml(spec))
    }

    /**
     * For the given folder, takes the cached sort order and persists to the order in the spec file.
     * @param folder Folder with the `.obsidian-library` spec to update
     */
    async updateSpecSortOrder(folder: TFolder) {
        const sortIndex = this.data.sortCache[folder.path].notes

        const spec = await this.getOrCreateFolderSpec(folder)
        spec.sort.notes.items = Object.entries(sortIndex).sort((a, b) => a[1] - b[1]).map((item) => item[0])
        this.saveFolderSpec(folder, spec)
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
 * - Add sorting options to notes list
 * - Drag and drop into folders for moving
 * - Multi-select for dragging and reordering... ugh
 * 
 * Nice to have:
 * - Undo/redo for manual sorting
 */
