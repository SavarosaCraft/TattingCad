#!/bin/sh
# TattingCAD .deb — after install (session 60): refresh the file-type,
# icon and launcher databases so .tatcad files get their icon and open
# with TattingCAD. Failures are ignored (these tools may be missing).
update-mime-database /usr/share/mime >/dev/null 2>&1 || true
gtk-update-icon-cache -q -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
update-desktop-database -q /usr/share/applications >/dev/null 2>&1 || true
exit 0
