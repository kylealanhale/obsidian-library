# Obsidian Library View

## To do

### Bugs
* sometimes can't click on note preview if preview is short (handler on wrong elem?)
* selected folder isn't indicated
* vault folder label isn't treated the same
* incorrect folder count because of attachments

### General
* column resizing
  * √ handle
  * commands, with width calculation to match non-doubled leaves
* notes list
  * observe changes
  * remember selection
  * perfect styles
  * clean up preview copy
    * √ front matter
    * redundant title (optional)
    * √ markup (either plain text or simple rich text)
* better native style integration
  * √ use native file explorer
  * light/dark mode.. use color variables in css
* drag and drop
* collapsed/selected state
  * unlink from stock file explorer
  * store which note is selected within folder
  * navigate to stored selected note or first note in list
  * better empty states
* sorting
  * UI
  * manual note sorting via dragging
  * stretch: manual folder sorting?

### Options
* show attachments folder
* show all supported file types instead of just notes
* note summary header: calculated vs filename vs none

### Mobile
* mobile UI considerations
* rewrite UI in svelte/react? what's the mobile impact for that? I guess none, since it's all transpiled to JS, and I can't add platform-specific compiled code either

## Tech debt
* typescript complaints and `@ts-ignore` congesting the place
