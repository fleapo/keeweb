!macro EnsureAppIsNotRunning
  ${For} $retryNumEnsureAppIsNotRunning 0 1000
    DetailPrint "Checking if ${PRODUCT_EXE} is running..."
    ; Use findstr exit code (0=found, 1=not found) to avoid StrFunc/Call in uninstall sections
    nsExec::ExecToStack /OEM 'cmd.exe /c tasklist /NH /FI "IMAGENAME eq ${PRODUCT_EXE}" | findstr /I /C:"${PRODUCT_EXE}"'
    Pop $0
    Pop $1
    ${If} $0 != 0
    ${AndIf} $0 != 1
      DetailPrint "Error checking ${PRODUCT_EXE}: $0"
      MessageBox MB_ICONSTOP|MB_OK "Failed to check whether process is running" /SD IDOK
      Quit
    ${EndIf}
    ${If} $0 == 1
      DetailPrint "${PRODUCT_EXE} is not running"
      ${If} $isUpdaterMode == 1
        Sleep 2000
      ${EndIf}
      ${ExitFor}
    ${Else}
      ${If} $isUpdaterMode == 1
      ${AndIf} $retryNumEnsureAppIsNotRunning < 5
        DetailPrint "${PRODUCT_EXE} is running, waiting... next check in 2s"
        Sleep 2000
      ${Else}
        MessageBox MB_ICONQUESTION|MB_OKCANCEL|MB_DEFBUTTON1 "To proceed, please close ${PRODUCT_NAME} and click OK" /SD IDCANCEL IDOK ok
        Quit
        ok:
      ${EndIf}
    ${EndIf}
  ${Next}
!macroend
