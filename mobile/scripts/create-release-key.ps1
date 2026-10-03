$ErrorActionPreference = 'Stop'
$androidRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\android')).Path
$keyPath = Join-Path $androidRoot 'app\national-release.keystore'
$propertiesPath = Join-Path $androidRoot 'keystore.properties'
if ((Test-Path -LiteralPath $keyPath) -or (Test-Path -LiteralPath $propertiesPath)) {
    throw 'A release key already exists. Keep and reuse it for every update; do not generate a replacement.'
}
$keytool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\keytool.exe' } else { 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe' }
if (-not (Test-Path -LiteralPath $keytool)) { throw 'Install Android Studio or set JAVA_HOME to a JDK that includes keytool.' }
$random = New-Object byte[] 24
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($random) } finally { $generator.Dispose() }
$password = [BitConverter]::ToString($random).Replace('-', '').ToLowerInvariant()
& $keytool -genkeypair -v -keystore $keyPath -alias national-enterprises -keyalg RSA -keysize 3072 -validity 10000 -storepass $password -keypass $password -dname 'CN=NATIONAL ENTERPRISES, OU=Collections, O=NATIONAL ENTERPRISES, C=IN'
if ($LASTEXITCODE -ne 0) { throw 'Could not create the release keystore.' }
@("storeFile=app/national-release.keystore", "storePassword=$password", 'keyAlias=national-enterprises', "keyPassword=$password") | Set-Content -LiteralPath $propertiesPath -Encoding ascii
Write-Output 'Release key created. Back up mobile/android/app/national-release.keystore and mobile/android/keystore.properties together. Neither file is committed to Git.'
