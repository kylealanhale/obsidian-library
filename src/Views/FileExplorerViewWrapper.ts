import { TFile, TAbstractFile, WorkspaceLeaf, TFolder, FileExplorerView, FileExplorerPlugin, FileExplorerNavFolder } from "obsidian";
import LibraryPlugin from "src/main";

// class FileExplorerView extends View { }
export type ClickHandler = (folder: TFolder) => void;

export class FileExplorerWrapper {
    clickHandler: ClickHandler
    view: FileExplorerView
    fileExplorerPlugin: FileExplorerPlugin
    plugin: LibraryPlugin
    selectedEl: HTMLDivElement

    constructor(leaf: WorkspaceLeaf, libraryPlugin: LibraryPlugin, clickHandler: ClickHandler) {
        const explorerDetails = libraryPlugin.app.internalPlugins.plugins['file-explorer']
        this.fileExplorerPlugin = explorerDetails.instance as FileExplorerPlugin
        const FileExplorerViewConstructor = explorerDetails.views['file-explorer'] as typeof FileExplorerView

        this.view = new FileExplorerViewConstructor(leaf)
        this.plugin = libraryPlugin
        this.clickHandler = clickHandler

        this.patchLoad()
        this.patchCreateFolderDom()
    }
    isNavigable(file: TAbstractFile) : boolean {
        // TODO: breaks when no attachments path is set
        const attachmentsPath = this.plugin.app.vault.getConfig("attachmentFolderPath").slice(2)
        if (file instanceof TFile) return false;
        if (file.name == attachmentsPath) return false;
        return true
    }

    patchLoad() {
        const instance = this;
        const originalLoad = instance.view.load.bind(this.view);
        instance.view.load = function () {
            originalLoad()

            // Return to the last selected folder
            instance.navigateToCurrentPath()
        }.bind(instance.view)
    }

    patchSort(navFolder: FileExplorerNavFolder) {
        // return
        const instance = this
        const originalSort = navFolder.sort.bind(navFolder)
        navFolder.sort = function() {
            const cache = instance.plugin.data.sortCache[this.file.path]
            if (!cache) {
                originalSort()
                return
            }

            const children = (this.file.children as [TAbstractFile])
                .filter((child) => child instanceof TFolder)  // No files allowed!
                .sort((first, second) => cache.folders[first.name] - cache.folders[second.name])
                .map((child) => this.fileExplorer.fileItems[child.path])
                .filter((child) => child)

            this.vChildren.setChildren(children)
        }.bind(navFolder)
    }

    /**
     * Patch the FileExplorerView to add a click handler to folders.
     */
    patchCreateFolderDom() {
        const instance = this
        const originalCreateFolderDom = instance.view.createFolderDom.bind(this.view)
        instance.view.createFolderDom = function (folder: TFolder) {
            let navFolder = originalCreateFolderDom(folder) as FileExplorerNavFolder
            instance.patchSort(navFolder)

            // Prevent normal collapse behavior, so that the click can
            // show notes via the clickHandler below
            const toggleCollapsed = navFolder.toggleCollapsed
            navFolder.toggleCollapsed = function() {}

            // Use collapse indicator for toggling collapse
            if (!folder.children.filter(instance.isNavigable.bind(instance)).length) navFolder.collapseEl.addClass('empty')
            else navFolder.collapseEl.addEventListener('click', function(event: Event) {
                event.stopPropagation()
                toggleCollapsed.call(navFolder, true)
            })

            // Let the parent view handle clicks
            navFolder.selfEl.addEventListener('click', (event: Event) => {
                instance.setActiveEl(navFolder.selfEl)
                instance.plugin.data.settings.currentPath = folder.path
                instance.clickHandler(folder)
            })

            return navFolder
        }.bind(instance.view)
    }

    setActiveEl(el: HTMLDivElement) {
        if (this.selectedEl) this.selectedEl.removeClass('is-active')
        this.selectedEl = el
        this.selectedEl.addClass('is-active')
    }

    navigateToCurrentPath() {
        let abstractFile = this.fileExplorerPlugin.app.vault.getAbstractFileByPath(this.plugin.data.settings.currentPath)
        let folder = abstractFile instanceof TFile ? (abstractFile as TFile).parent as TFolder : abstractFile as TFolder
        if (folder instanceof TFile) folder = (folder as TFile).parent as TFolder
        let navItem = this.view.fileItems[folder.path]
        this.plugin.loadLibraryData()
        this.view.sort()

        this.view.revealInFolder(folder)

        this.view.setFocusedItem(null)
        this.setActiveEl(navItem.selfEl)
        this.clickHandler(folder)
    }
}
