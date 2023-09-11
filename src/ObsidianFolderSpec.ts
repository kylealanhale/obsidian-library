export type SortDefinition = {
    field: 'title' | 'created' | 'modified' | 'manual'
    direction: 'ascending' | 'descending'
    items: string[]
}
export interface ObsidianFolderSpec {
    sort: {
        folders: SortDefinition
        notes: SortDefinition
    }
}
