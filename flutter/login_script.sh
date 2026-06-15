adb shell input tap 540 1275 # Tap phone field
sleep 1
adb shell input text "9876543210"
sleep 1
adb shell input tap 540 1780 # Tap Send OTP
sleep 8
adb shell input text "111111"
sleep 2
adb shell input tap 540 2012 # Tap Verify
