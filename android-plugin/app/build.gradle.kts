plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "local.rokid.codex"
    compileSdk = 36
    defaultConfig {
        applicationId = "local.rokid.codex"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
    flavorDimensions += "runtime"
    productFlavors {
        create("direct") { dimension = "runtime" }
        create("nexus") { dimension = "runtime"; applicationIdSuffix = ".nexus" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions { jvmTarget = "11" }
}
dependencies {
    "nexusImplementation"("com.github.Anezium.Rokid-Nexus:bus-client:sdk-v0.15.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
