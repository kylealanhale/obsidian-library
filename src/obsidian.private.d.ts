import 'obsidian';

declare module 'obsidian' {
    export class FileExplorerView extends View {
        fileItems: { [key: string]: FileExplorerNavBase };
        files: WeakMap<HTMLDivElement, TAbstractFile>;
        onCreate(file: TAbstractFile): void;
        createFolderDom(folder: TFolder): FileExplorerNavFolder;
        getViewType(): string;
        getDisplayText(): string;
        revealInFolder(path: string): void;
        sort(): void;
        setFocusedItem(item: FileExplorerNavBase | null): void;
    }

    export class InternalPlugins {
        getPluginById(id: string): Plugin
        plugins: { [key: string] : PluginDetails }
    }

    export class FileExplorerPlugin extends Plugin {
        revealInFolder(fileItem: TAbstractFile): void
    }

    export class PluginDetails {
        instance: Plugin
        views: { [key: string] : typeof View }
    }

    export interface App {
        internalPlugins: InternalPlugins
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
        selfEl: HTMLDivElement;
        titleInnerEl: HTMLDivElement;
        fileExplorer: FileExplorerView;
    }

    export interface FileExplorerNavFile extends FileExplorerNavBase {
        file: TFile;
    }

    export interface FileExplorerNavFolder extends FileExplorerNavBase {
        file: TFolder;
        childrenEl: HTMLDivElement;
        collapseEl: HTMLDivElement;
        toggleCollapsed(yes: boolean): void;
    }
}
