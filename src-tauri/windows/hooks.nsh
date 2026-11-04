; TattingCAD — NSIS installer hooks (session 60)
;
; Tauri registers the .tatcad file type with the program's own icon
; ("TattingCAD.exe,0"). This points it at the document icon instead — a page
; with the TattingCAD logo — installed with the app as a resource
; (bundle.resources: "icons/tatcad-document.ico" → $INSTDIR\icons\).
; "TattingCAD Pattern" is the file-type key Tauri creates: the "name" of the
; .tatcad entry in bundle.fileAssociations (keep the two the same).
; If the icon file isn't there, nothing is changed (the program icon stays).
; Uninstalling needs nothing extra: Tauri deletes the whole file-type key,
; this icon setting included.

!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$INSTDIR\icons\tatcad-document.ico"
    WriteRegStr SHCTX "Software\Classes\TattingCAD Pattern\DefaultIcon" "" "$INSTDIR\icons\tatcad-document.ico"
    ; Tell Explorer that file-type icons changed (SHCNE_ASSOCCHANGED).
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  ${EndIf}
!macroend
