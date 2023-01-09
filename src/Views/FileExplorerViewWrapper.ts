import { TFile, TAbstractFile, View, App, WorkspaceLeaf, TFolder, FileExplorerView } from "obsidian";

export const VIEW_TYPE_MODIFIED_FILE_EXPLORER = "modified-file-explorer";

// class FileExplorerView extends View { }
export type ClickHandler = (event: Event | null, folder: TFolder) => void;

export class FileExplorerViewWrapper {
    clickHandler: ClickHandler
    view: FileExplorerView

    constructor(leaf: WorkspaceLeaf, app: App, clickHandler: ClickHandler) {
        const FileExplorerView = app.internalPlugins.plugins['file-explorer'].views['file-explorer']
        this.view = new FileExplorerView(leaf)
        this.clickHandler = clickHandler

        this.patchOnCreate()
        this.patchCreateFolderDom()
    }

    isNavigable(file: TAbstractFile) : boolean {
        if (file instanceof TFile) return false;
        const attachmentsPath = app.vault.getConfig("attachmentFolderPath").slice(2)
        if (file.name == attachmentsPath) return false;
        return true
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
        let selectedEl: HTMLDivElement
        instance.view.createFolderDom = function (folder: TFolder) {
            let navFolder = createFolderDom.call(instance.view, folder)

            // Prevent normal collapse behavior, so that the click can
            // show notes via the clickHandler below
            const toggleCollapsed = navFolder.toggleCollapsed
            navFolder.toggleCollapsed = function() {}

            // Use collapse indicator for toggling collapse
            if (!folder.children.filter(instance.isNavigable).length) navFolder.collapseIndicatorEl.addClass('empty')
            else navFolder.collapseIndicatorEl.addEventListener('click', function(event: Event) {
                event.stopPropagation()
                toggleCollapsed.call(navFolder, true)
            })

            // Let the parent view handle clicks
            navFolder.titleEl.addEventListener('click', (event: Event) => {
                if (selectedEl) selectedEl.removeClass('is-active')
                selectedEl = navFolder.titleEl
                selectedEl.addClass('is-active')
                instance.clickHandler(event, folder)
            })

            return navFolder
        }
    }
}
