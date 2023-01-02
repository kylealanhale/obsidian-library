
import { getEventListeners } from "events";
import { TFile, TAbstractFile, View, App, WorkspaceLeaf, TFolder, Vault } from "obsidian";

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
        let instance = new FileExplorerView(leaf)

        this.patchOnCreate(instance)
        this.patchCreateFolderDom(instance, clickHandler)

        instance.icon = 'library'
        return instance
    }

    getViewType(): string {
        return VIEW_TYPE_MODIFIED_FILE_EXPLORER
    }

    patchOnCreate(instance: any) {
        const onCreate = instance.onCreate
        instance.onCreate = function(file: TAbstractFile) {
            if (file instanceof TFile) return;
            // @ts-ignore
            const attachmentsPath = app.vault.config.attachmentFolderPath.slice(2)
            if (file.name == attachmentsPath) return;

            onCreate.call(this, file)
        }
    }

    patchCreateFolderDom(instance: any, clickHandler: any) {
        const createFolderDom = instance.createFolderDom
        instance.createFolderDom = function (folder: TFolder) {
            let navFolder = createFolderDom.call(instance, folder)

            // Prevent normal collapse behavior, so that the click can
            // show notes via the clickHandler below
            const toggleCollapsed = navFolder.toggleCollapsed
            navFolder.toggleCollapsed = function() {}

            // Use collapse indicator for toggling collapse
            navFolder.collapseIndicatorEl = navFolder.titleEl.querySelector('.nav-folder-collapse-indicator')
            navFolder.collapseIndicatorEl.addEventListener('click', function(event: Event) {
                event.stopPropagation()
                toggleCollapsed.call(navFolder, true)
            })

            // Let the parent view handle clicks
            if (clickHandler) {
                navFolder.titleEl.addEventListener('click', (event: Event) => {
                    clickHandler(event, folder)
                })
            }

            return navFolder
        }
    }
}
