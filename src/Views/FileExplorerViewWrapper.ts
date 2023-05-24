import { TFile, TAbstractFile, App, WorkspaceLeaf, TFolder, FileExplorerView, FileExplorerPlugin, Plugin, PluginDetails } from "obsidian";
import LibraryPlugin from "src/main";

// class FileExplorerView extends View { }
export type ClickHandler = (event: Event | null, folder: TFolder) => void;

export class FileExplorerWrapper {
    clickHandler: ClickHandler
    view: FileExplorerView
    plugin: FileExplorerPlugin
    library: LibraryPlugin
    selectedEl: HTMLDivElement

    constructor(leaf: WorkspaceLeaf, libraryPlugin: LibraryPlugin, clickHandler: ClickHandler) {
        const explorerDetails = libraryPlugin.app.internalPlugins.plugins['file-explorer']
        this.plugin = explorerDetails.instance as FileExplorerPlugin
        const FileExplorerViewConstructor = explorerDetails.views['file-explorer'] as typeof FileExplorerView

        this.view = new FileExplorerViewConstructor(leaf)
        this.library = libraryPlugin
        this.clickHandler = clickHandler

        this.patchOnCreate()
        this.patchCreateFolderDom()
        this.view.onload = this.onload.bind(this.view)
        console.log('this.view.fileItems:', Object.keys(this.view.fileItems))
        // this.view.dom.infinityScroll.rootEl = this.view.fileItems["/"]
        // const instance = this
        // const computeSync = this.view.dom.infinityScroll.computeSync
        // this.view.dom.infinityScroll.computeSync = function() {
        //     console.log('this:', this, 'this.rootEl:', this.rootEl)
        //     computeSync.call(this)
        // }


    }

    isNavigable(file: TAbstractFile) : boolean {
        if (file instanceof TFile) return false;
        const attachmentsPath = app.vault.getConfig("attachmentFolderPath").slice(2)
        if (file.name == attachmentsPath) return false;
        return true
    }

    onload() {
        console.log('onload!!!')
    }

    patchLoad() {
        const instance = this;
        const load = instance.view.load;
        instance.view.load = function () {
            console.log('loading')
            load.call(this);
            instance.revealCurrentPath()
        }
    }

    patchOnCreate() {
        const instance = this
        const onCreate = instance.view.onCreate
        instance.view.onCreate = function(file: TAbstractFile) {
            if (!instance.isNavigable(file)) return;
            onCreate.call(this, file)
        }
    }

    patchCreateFolderDom() {
        const instance = this
        const createFolderDom = instance.view.createFolderDom
        instance.view.createFolderDom = function (folder: TFolder) {
            let navFolder = createFolderDom.call(instance.view, folder)

            // Prevent normal collapse behavior, so that the click can
            // show notes via the clickHandler below
            const toggleCollapsed = navFolder.toggleCollapsed
            navFolder.toggleCollapsed = function() {}

            // Use collapse indicator for toggling collapse
            if (!folder.children.filter(instance.isNavigable).length) navFolder.collapseEl.addClass('empty')
            else navFolder.collapseEl.addEventListener('click', function(event: Event) {
                event.stopPropagation()
                toggleCollapsed.call(navFolder, true)
            })

            // Let the parent view handle clicks
            navFolder.selfEl.addEventListener('click', (event: Event) => {
                instance.setActiveEl(navFolder.selfEl)
                instance.library.settings.currentPath = folder.path
                instance.clickHandler(event, folder)
            })

            return navFolder
        }
    }

    setActiveEl(el: HTMLDivElement) {
        if (this.selectedEl) this.selectedEl.removeClass('is-active')
        this.selectedEl = el
        this.selectedEl.addClass('is-active')
    }

    revealCurrentPath() {
        let abstractFile = this.plugin.app.vault.getAbstractFileByPath(this.library.settings.currentPath)
        let folder: TFolder = abstractFile instanceof TFile ? (abstractFile as TFile).parent : abstractFile as TFolder
        if (folder instanceof TFile) folder = (folder as TFile).parent
        let navItem = this.view.fileItems[folder.path]
        this.library.loadSettings()
        console.log(this.library.settings, this.view.files, this.view.fileItems)
        this.view.sort()

        // TODO: change to manual reveal
        this.view.revealInFolder(folder.path)

        this.view.setFocusedItem(null)
        this.setActiveEl(navItem.selfEl)
        this.clickHandler(null, folder)
    }
}
