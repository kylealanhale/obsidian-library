import { TFile, TAbstractFile, View, App, WorkspaceLeaf, TFolder } from "obsidian";

export const VIEW_TYPE_MODIFIED_FILE_EXPLORER = "modified-file-explorer";

export class ModifiedFileExplorerView extends View {
    getDisplayText(): string {
        return 'Notes'
    }
    constructor(leaf: WorkspaceLeaf, app: App, clickHandler: ((event: Event | null, folder: TFolder) => void) | null) {
        // @ts-ignore
        leaf.app = app
        super(leaf);

        // @ts-ignore
        const FileExplorerView = app.internalPlugins.plugins['file-explorer'].views['file-explorer']
        let fileExplorer = new FileExplorerView(leaf)

        this.patchOnCreate(fileExplorer)
        this.patchCreateFolderDom(fileExplorer, clickHandler)

        fileExplorer.icon = 'library'
        return fileExplorer
    }

    getViewType(): string {
        return VIEW_TYPE_MODIFIED_FILE_EXPLORER
    }

    isNavigable(file: TAbstractFile) : boolean {
        if (file instanceof TFile) return false;
        // @ts-ignore
        const attachmentsPath = app.vault.config.attachmentFolderPath.slice(2)
        if (file.name == attachmentsPath) return false;
        return true
    }

    patchOnCreate(fileExplorer: any) {
        const onCreate = fileExplorer.onCreate
        const instance = this
        fileExplorer.onCreate = function(file: TAbstractFile) {
            if (!instance.isNavigable(file)) return;

            onCreate.call(this, file)
        }
    }

    patchCreateFolderDom(fileExplorer: any, clickHandler: any) {
        const instance = this
        const createFolderDom = fileExplorer.createFolderDom
        let selectedEl: HTMLDivElement
        fileExplorer.createFolderDom = function (folder: TFolder) {
            let navFolder = createFolderDom.call(fileExplorer, folder)

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
            if (clickHandler) {
                navFolder.titleEl.addEventListener('click', (event: Event) => {
                    if (selectedEl) selectedEl.removeClass('is-active')
                    selectedEl = navFolder.titleEl
                    selectedEl.addClass('is-active')
                    clickHandler(event, folder)
                })
            }

            return navFolder
        }
    }
}
