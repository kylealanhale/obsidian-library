// @ts-nocheck
import { TFile, TAbstractFile } from "obsidian";

export const VIEW_TYPE_MODIFIED_FILE_EXPLORER = "modified-file-explorer-view";
export function getModifiedFileExplorerView(app, leaf) {
    let fileExplorerView = app.internalPlugins.plugins['file-explorer'].views['file-explorer'](leaf)

    fileExplorerView.getViewType = () => VIEW_TYPE_MODIFIED_FILE_EXPLORER
    fileExplorerView.getDisplayText = () => 'Notes'
    fileExplorerView.icon = 'library'

    const onCreate = fileExplorerView.onCreate
    fileExplorerView.onCreate = function(file: TAbstractFile) {
        if (file instanceof TFile) return;
        onCreate.call(this, file)
    }

    return fileExplorerView
}
