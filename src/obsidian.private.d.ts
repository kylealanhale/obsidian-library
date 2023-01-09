import 'obsidian';

declare module 'obsidian' {
    export class FileExplorerView extends View {
        fileItems: { [key: string]: FileExplorerNavBase };
        files: WeakMap<HTMLDivElement, TAbstractFile>;
        onCreate(file: TAbstractFile): void;
        createFolderDom(folder: TFolder): FileExplorerNavFolder;
        getViewType(): string;
        getDisplayText(): string;
    }

    export interface App {
        internalPlugins: { 'plugins': { [key: string] : Plugin } }
    }

    export interface WorkspaceLeaf {
        containerEl: Element
    }

    export interface WorkspaceSplit {
        containerEl: Element
        insertChild(index: number, leaf: WorkspaceLeaf): void
    }

    export interface Plugin {
        views: { [key: string] : any }
    }

    export interface Vault {
        getConfig(name: string): any;
    }

    export interface FileExplorerNavBase {
        el: HTMLDivElement;
        titleEl: HTMLDivElement;
        titleInnerEl: HTMLDivElement;
        fileExplorer: FileExplorerView;
    }

    export interface FileExplorerNavFile extends FileExplorerNavBase {
        file: TFile;
    }

    export interface FileExplorerNavFolder extends FileExplorerNavBase {
        file: TFolder;
        childrenEl: HTMLDivElement;
        collapseIndicatorEl: HTMLDivElement;
    }
}
