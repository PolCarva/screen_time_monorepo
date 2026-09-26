package com.still.screentime

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ensureReactNativeLoaded()
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(StillRestrictionPackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    instance = this
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    // React Native loads when something needs it (the app's screen), not here:
    // when Android starts the process only to bind the accessibility service,
    // that start has to finish quickly (docs/android-parity-plan.md §15).
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }

  companion object {
    @Volatile private var instance: MainApplication? = null
    private var reactNativeLoaded = false

    /**
     * Loads React Native's libraries and New Architecture flags, once. The
     * React host calls it before it is built, and MainActivity before
     * ReactActivity reads `fabricEnabled`, which happens in its constructor.
     */
    @JvmStatic
    fun ensureReactNativeLoaded() {
      val application = instance ?: return
      synchronized(this) {
        if (reactNativeLoaded) return
        loadReactNative(application)
        reactNativeLoaded = true
      }
    }
  }
}
