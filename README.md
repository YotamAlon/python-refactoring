# python-refactoring README
VSCode extension that provides an expanded refactoring catalog.

Select code to refactor and type `ctrl`+`shift`+`r` to bring up the refactoring menu which should now be filled with goodies!

In early ALPHA!!!

Please use with caution and report any issues you find.

## Features

Using pylsp with pylsp-rope to provide many automated python refactoring actions.

pylsp itself comes with many features similar to those provided by the microsoft python extension. To avoid conflicts they were all disabled but can be re-enabled through the settings.

## Requirements

You must install VSCode's python extension first.

## Extension Settings

Available under 'pylsp' settings.

## Known Issues

Nothing is guarenteed to work at the moment.

The refactoring menu provides many options, some of are not really relevant to the code you have selected. That is an issue coming from pylsp-rope. 

I hope I'll have time to contribute there to fix it.

## Release Notes

#### V0.0.13

Updated extension page.

#### V0.0.12

Disabled all default pylsp options to avoid conflicts with microsoft's python extension.

#### V0.0.11

Added pylsp server output to vscode's output window.

#### V0.0.6-V0.0.9

Garbage versions from when microsoft had issues with their publish pipeline. Not sure how to unpublish them yet.

#### V0.0.5

Switched to using pylsp with pylsp-rope.

---


**Enjoy!**
