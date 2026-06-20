# Flutter keep rules
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Voltium device admin receiver and activity
-keep class com.voltiumelectric.voltium.VoltiumDeviceAdminReceiver { *; }
-keep class com.voltiumelectric.voltium.MainActivity { *; }

# flutter_secure_storage platform channel
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# flutter_contacts platform channel
-keep class com.sarbagyastudios.flutter_contacts.** { *; }

# call_log platform channel
-keep class dev.buijs.call_log.** { *; }

# sqflite platform channel
-keep class com.tekartik.sqflite.** { *; }

# firebase_messaging
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.** { *; }

# geolocator
-keep class com.baseflow.geolocator.** { *; }

# permission_handler
-keep class com.baseflow.permissionhandler.** { *; }

# image_picker / image_cropper
-keep class io.flutter.plugins.imagepicker.** { *; }
-keep class com.yalantis.ucrop.** { *; }

# local_auth
-keep class androidx.biometric.** { *; }
-keep class io.flutter.plugins.localauth.** { *; }
