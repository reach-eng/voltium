package in.voltium.rider

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.UserManager
import android.provider.Settings
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "in.voltium.rider/device_policy"

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val adminComponent = ComponentName(this, VoltiumDeviceAdminReceiver::class.java)

            when (call.method) {
                "isDeviceAdminActive" -> {
                    result.success(dpm.isAdminActive(adminComponent))
                }
                "requestDeviceAdmin" -> {
                    val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
                    intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                    intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enabling Voltium Device Security for rental compliance.")
                    startActivityForResult(intent, 1001)
                    result.success(true)
                }
                "canDrawOverlays" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        result.success(Settings.canDrawOverlays(this))
                    } else {
                        result.success(true)
                    }
                }
                "requestOverlayPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                        startActivity(intent)
                        result.success(true)
                    } else {
                        result.success(true)
                    }
                }
                "lockDevice" -> {
                    if (dpm.isAdminActive(adminComponent)) {
                        dpm.lockNow()
                        result.success(true)
                    } else {
                        result.error("UNAUTHORIZED", "Device Admin not active", null)
                    }
                }
                "factoryReset" -> {
                    if (dpm.isAdminActive(adminComponent)) {
                        // WARNING: This will wipe the device. 
                        dpm.wipeData(0) 
                        result.success(true)
                    } else {
                        result.error("UNAUTHORIZED", "Device Admin not active", null)
                    }
                }
                "setCameraDisabled" -> {
                    val disabled = call.argument<Boolean>("disabled") ?: false
                    if (dpm.isAdminActive(adminComponent)) {
                        dpm.setCameraDisabled(adminComponent, disabled)
                        result.success(true)
                    } else {
                        result.error("UNAUTHORIZED", "Device Admin not active", null)
                    }
                }
                "setPasscodeRequirement" -> {
                    val length = call.argument<Int>("minLength") ?: 4
                    if (dpm.isAdminActive(adminComponent)) {
                        dpm.setPasswordQuality(adminComponent, DevicePolicyManager.PASSWORD_QUALITY_NUMERIC_COMPLEX)
                        dpm.setPasswordMinimumLength(adminComponent, length)
                        result.success(true)
                    } else {
                        result.error("UNAUTHORIZED", "Device Admin not active", null)
                    }
                }
                "setUninstallBlocked" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    try {
                        if (dpm.isAdminActive(adminComponent)) {
                            dpm.setUninstallBlocked(adminComponent, packageName, enabled)
                            result.success(true)
                        } else {
                            result.error("UNAUTHORIZED", "Device Admin not active", null)
                        }
                    } catch (e: Exception) {
                        result.error("SECURITY_ERROR", e.message, null)
                    }
                }
                "setLocationMandatory" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    try {
                        if (dpm.isAdminActive(adminComponent)) {
                            if (enabled) {
                                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_LOCATION)
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                                    dpm.setLocationEnabled(adminComponent, true)
                                }
                            } else {
                                dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_LOCATION)
                            }
                            result.success(true)
                        } else {
                            result.error("UNAUTHORIZED", "Device Admin not active", null)
                        }
                    } catch (e: Exception) {
                        result.error("SECURITY_ERROR", e.message, null)
                    }
                }
                "setAppsControlDisabled" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: false
                    try {
                        if (dpm.isAdminActive(adminComponent)) {
                            if (enabled) {
                                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_APPS_CONTROL)
                            } else {
                                dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_APPS_CONTROL)
                            }
                            result.success(true)
                        } else {
                            result.error("UNAUTHORIZED", "Device Admin not active", null)
                        }
                    } catch (e: Exception) {
                        result.error("SECURITY_ERROR", e.message, null)
                    }
                }
                "isMockLocationEnabled" -> {
                    val isMock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        // On Android 12+, we'd check via location object normally, 
                        // but we can check settings as a fallback or hint.
                        Settings.Secure.getString(contentResolver, Settings.Secure.ALLOW_MOCK_LOCATION) == "1"
                    } else {
                        @Suppress("DEPRECATION")
                        Settings.Secure.getString(contentResolver, Settings.Secure.ALLOW_MOCK_LOCATION) == "1"
                    }
                    result.success(isMock)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
}
