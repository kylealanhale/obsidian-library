import { ItemView, WorkspaceContainer, WorkspaceItem, WorkspaceLeaf, WorkspaceSplit, Vault, TFolder, TFile } from "obsidian";

export const VIEW_TYPE_THREE_PANE_PARENT = "three-pane-parent-view";
export const VIEW_TYPE_THREE_PANE_CHILD = "three-pane-child-view";

export class ThreePaneParentView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_THREE_PANE_PARENT;
    }

    getDisplayText() {
        return "Notes";
    }

    async onOpen() {
        const vaultName = this.app.vault.getName()
        this.icon = "library"
        const container = this.containerEl.children[1];
        container.empty();
        container.addClasses(['workspace-split', 'mod-left-split', 'three-pane'])

        const folders = container.createDiv({cls: 'nav-folder mod-root'})
        const title = folders.createDiv({cls: 'nav-folder-title'})
        title.createDiv({text: vaultName, cls: 'nav-folder-title-content'})

        const children = folders.createDiv({cls: 'nav-folder-children'})
        this.app.vault.getRoot().children.forEach(child => {
            if (child instanceof TFile) return;
            const folder = children.createDiv({cls: 'nav-folder'})
            const title = folder.createDiv({cls: 'nav-folder-title'})
            title.createDiv({text: child.name, cls: 'nav-folder-title-content'})

            title.onClickEvent((event: MouseEvent) => {
                console.log('hey');
                title.addClass('is-active')
            })
        });
        // const divider = container.createEl('hr', {cls: "workspace-leaf-resize-handle"})
        // const notes = container.createDiv({cls: "notes", text: "Notes"})


    }

    async onClose() {
        // Nothing to clean up.
    }
}

export class ThreePaneChildSplit extends WorkspaceSplit {
    root: WorkspaceLeaf
    constructor(root: WorkspaceLeaf) {
        super();
        this.root = root
    }

    getContainer(): WorkspaceContainer {
        return this.root.getContainer()
    }

    getRoot(): WorkspaceItem {
        return this.root
    }
}

export class ThreePaneChildView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_THREE_PANE_CHILD;
    }

    getDisplayText() {
        return "Three Pane child view";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.createEl("h4", { text: "Here's a child pane"});
    }

    async onClose() {
        // Nothing to clean up.
    }
}
