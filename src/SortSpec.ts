export type SortDefinition = {
    sort: 'title' | 'created' | 'modified' | 'manual'
    direction: 'ascending' | 'descending'
    items: string[]
    manualSortIndex: { [key: string]: number }
}
export interface SortSpec {
    id: string
    folders: SortDefinition
    notes: SortDefinition
}
