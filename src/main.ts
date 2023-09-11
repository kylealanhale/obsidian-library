import { App, EventRef, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { LibraryView, VIEW_TYPE_LIBRARY, EventHandler } from 'src/Views/LibraryView';
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
    updateHandler: Function | null = null

    /**
     * Caches file ID to memory; has side effects of updating front matter
     * in md file and sort order in .obsidian-library file.
     * @param file File to cache
     */
    async cacheFolderToMemory(folder: TFolder) {
        // Cache sort index; must happen immediately to avoid race conditions
        let sortCache = this.data.sortCache[folder.path]

        let spec = await this.getOrCreateFolderSpec(folder)
        spec.sort.folders.items.forEach((item, index) => {
            sortCache.folders[item] = index
        })
        spec.sort.notes.items.forEach((item, index) => {
            sortCache.notes[item] = index
        })
        sortCache.notes.hasOwnProperty('undefined') && delete sortCache.notes['undefined']

        // Why am I getting weird numbers in the cache?

        folder.children.forEach((abstractFile) => {
            if (abstractFile instanceof TFile && !sortCache.notes.hasOwnProperty(abstractFile.name)) {
                sortCache.notes[abstractFile.name] = Object.keys(sortCache.notes).length
            }
            else if (abstractFile instanceof TFolder && !sortCache.folders.hasOwnProperty(abstractFile.name)) {
                sortCache.folders[abstractFile.name] = Object.keys(sortCache.folders).length               
            }
        })
    }

    async onload() {
        console.log('*************************** Starting Library Plugin ***************************')
        await this.loadLibraryData()

        this.addSettingTab(new LibrarySettingsTab(this.app, this))

        this.app.workspace.onLayoutReady(async () => {
            this.activateView()
        })

        this.metadataEvents.push(this.app.metadataCache.on('changed', async (file, _, metadata) => {
            // console.log('metadata changed:', file, metadata)
            // Cache parent folder if it hasn't been already
            let parent = file.getParent()
            if (this.data.sortCache[parent.path]) { return }
            this.data.sortCache[parent.path] = {folders: {} as SortIndex, notes: {} as SortIndex}
            await this.cacheFolderToMemory(parent)
            this.saveLibraryData()
        }))

        // let createNotice = new Notice('create...', 10000000);
        // this.vaultEvents.push(this.app.vault.on('create', async (file) => {
        //     createNotice.setMessage(`create: ${file.path}`)
        //     if (!(file instanceof TFile)) { return }

        //     await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        //         // frontMatter.uid = id
        //     })
        //     let spec = await this.getOrCreateFolderSpec(file.getParent())
        //     // spec.notes.items.push(id)
        //     this.saveFolderSpec(file.getParent(), spec)

        //     await this.cacheFolderToMemory(file.getParent())
        //     this.saveLibraryData()

        //     if (this.updateHandler) this.updateHandler(file.getParent())

        //     /**
        //      * Order:
        //      * - Write ID to front matter
        //      * - Write ID to folder spec (side effect: creates if not present)
        //      * - Make sure folder gets processed (it short circuits above)
        //      * - Process to cache (make sure folder gets re-processed)
        //      */            
        // }))
        // // let modifyNotice = new Notice('modify...', 10000000);
        // // this.vaultEvents.push(this.app.vault.on('modify', async (file) => {
        // //     modifyNotice.setMessage(`modify: ${file.path}`)
        // //     if (!(file instanceof TFile)) { return }

        // //     // Check to see if metadataCache's copy of the front matter is different and if so to revert it
        // //     const id = this.data.ids[file.path]
        // //     const frontMatter = this.app.metadataCache.getCache(file.path)?.frontmatter
        // //     if (frontMatter?.uid != id) {
        // //         await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        // //             frontMatter.uid = id
        // //         })
        // //     }

        // //     if (this.updateHandler) this.updateHandler(file.getParent())
        // // }))
        // let renameNotice = new Notice('rename...', 10000000);
        // this.vaultEvents.push(this.app.vault.on('rename', (file, oldPath) => {
        //     renameNotice.setMessage(`rename: ${file.path} from ${oldPath}`)
        //     if (!(file instanceof TFile)) { return }

        //     let id = this.data.ids[oldPath]
        //     delete this.data.ids[oldPath]
        //     this.data.ids[file.path] = id
        //     this.saveLibraryData()

        //     if (this.updateHandler) this.updateHandler(file.getParent())
        // }))
        // let deleteNotice = new Notice('delete...', 10000000);
        // this.vaultEvents.push(this.app.vault.on('delete', async (file) => {
        //     deleteNotice.setMessage(`delete: ${file.path}`)
        //     if (!(file instanceof TFile)) { return }

        //     let id = this.data.ids[file.path]
        //     delete this.data.ids[file.path]
        //     this.saveLibraryData()

        //     let spec = await this.getOrCreateFolderSpec(file.getParent())
        //     spec.notes.items.remove(id)
        //     this.saveFolderSpec(file.getParent(), spec)

        //     if (this.updateHandler) this.updateHandler(file.getParent())
        // }))
    }
    async getOrCreateFileId(file: TFile): Promise<string> {
        let id: string = ""
        await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
            console.log('processing frontmatter:', frontMatter)
            if (frontMatter.uid) id = frontMatter.uid
            else {
                frontMatter.uid = id
                // Store id to folder sort spec
            }
        })
        return id
    }

    handleUpdates(handler: Function) {
        this.updateHandler = handler
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

    // Gets the sort index for the given folder from the cache. Used
    // when manually reordering.
    getCachedNotesSortIndex(folder: TFolder): SortIndex {
        return this.data.sortCache[folder.path].notes
    }
    // The opposite of the above; stores to cache and disk. Used
    // to persist manual reordering.
    async persistNotesSortIndex(folder: TFolder, sortIndex: SortIndex) {
        this.data.sortCache[folder.path].notes = sortIndex

        const spec = await this.getOrCreateFolderSpec(folder)
        spec.sort.notes.items = Object.entries(sortIndex).sort((a, b) => a[1] - b[1]).map((item) => item[0])
        this.saveFolderSpec(folder, spec)
        await this.saveLibraryData()
    }
    getNoteSortOrder(file: TFile): number | null {
        return this.data.sortCache[file.getParent().path].notes[file.name]
    }
    setNoteSortOrder(file: TFile, order: number): void {
        this.data.sortCache[file.getParent().path].notes[file.name] = order
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
 * - Update notes list when new note is created, deleted, or moved
 * - Add sorting options to notes list
 * - Undo/redo
 * - Handle scenario of previously un-sorted notes (create them when expected and not found)
 * - So many bugs now... deleting is stalling the whole damned thing, and dragging to
 *   reorder newly created notes isn't great. Tech debt babyyyyyy
 * - fix damage done to uids in 4a976d52c.. I can probably check for all the created files,
 *   set those aside, and revert the rest, after some checking and obvious knowns like lyric
 *   sheets. And no more dev without content checkpoints.
 */

/**
 * Library data points for a file:
 * - file id on disk (front matter)
 * - file sort order on disk (.obsidian-library)
 * - file id in cache, memory and disk (plugin.data; ./data.json)
 * - folder sort orders in cache, memory and disk (plugin.data; ./data.json)
 */