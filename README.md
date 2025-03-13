# Foobar Now Playing (Dev 0.2.0)
![GitHub License](https://img.shields.io/github/license/TheSquiddyLink/Foo-NowPlaying)
![GitHub Release](https://img.shields.io/github/v/release/TheSquiddyLink/Foo-NowPlaying?include_prereleases)
![GitHub last commit](https://img.shields.io/github/last-commit/TheSquiddyLink/Foo-NowPlaying)

*NOTE* this is a dev commit, please visit https://github.com/TheSquiddyLink/Foo-NowPlaying/releases for a Stable or Alpha release. Downloading the code directly from this branch may result in the website not functioning properly.

This project provides a customizable website that can be directly incorporated within OBS, and can communicate with Foobar2000 without the need of an external server.

This project is currently in alpha, things may not work fully or have placeholder colors, sizes, and images. 

Check for the newest release here: https://github.com/TheSquiddyLink/Foo-NowPlaying/releases

## Installation

To install this project you will need the following: 

* [Foobar2000](https://www.foobar2000.org) (Tested on V2.24 x86 - Portable)
* [Foo Beefweb](https://github.com/hyperblast/Beefweb) (Tested on v0.10)
* [OBS](https://obsproject.com) (Tested on 31.0.2)
* This Project (Source Code or GitHub release)
* Windows 10/11 (Tested on Windows 10 Home)

### Foobar2000

No additional configuration is required for this project to work with Beefweb in Foobar2000. If issues occur this is the configuration that has been tested with this project.

* Version: 2.24
* Architecture 32-bit (x86)
* Installation type: Portable

### Beefweb

 
Download the latest `fb2k-component` file from [GitHub](https://github.com/hyperblast/Beefweb/releases). Version 0.10 has been tested and verified, however newer ones may have more Advanced configuration. 

Open Foobar2000, go to file → preferences (`ctrl+p`) then go to components and press `install`. Locate the file previously downloaded, selected it, and restart foobar2000 after Installation.

After restarting Foobar2000, open Preferences (`Ctrl+P`), go to Tools → Beefweb Remote Control, and set the following options:

* Port: 8880
* All remote connections: enabled
* Require Authentication: disabled (This is currently required for proper operation but will be configurable in a future update. If running on an exposed network, consider modifying this project manually).

Afterwords navigate to tools → Beefweb Remote Control → Permissions and set the following:

* Changing playlists: disabled
* Changing output device: disabled
* Changing default web interface configuration: disabled

Note: These settings are not required for this project and should remain disabled for security purposes unless explicitly needed."

To verify that Beefweb is working, navigate to http://localhost:8880, you should see Beefwebs built-in website.

We are done with Beefweb for now, but will return to it later.

### Foobar Now Playing

There are two ways to use this project, the recommend way is to download the newest release on this [GitHub](https://github.com/TheSquiddyLink/Foo-NowPlaying/), or by downloading the source code manually or with git. 

After downloading, note the file path of the extracted folder. Navigate to your foobar2000 Installation, and head to profile → Beefweb,and create a new file called `config.json`.

When adding this config, there are two ways to set it, either by allowing CORS, or by providing the file path to the project folder. The file path would be Recommended, however if you are running your own server, it can be Beneficial to use CORS. 

In almost all cases use the file path method.


```json
{
    "urlMappings": {
        "/nowplaying": "C:\\path\\to\\project\\folder"
    }
} 
```
Input the path that you had copied earlier and ensure that the path follows the correct JSON format by escaping backslashes (`\\`)

Only if you are using your own server and need CORS, input the following:
```json
{
    "responseHeaders": {
        "Access-Control-Allow-Origin": "*"
    }
}
```
Please read [documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) to find out how to set up CORS headers properly.

Once this has been done restart foobar2000, and navigate to http://localhost:8880/nowplaying. When a song is playing you should now see information about the song.

### OBS
To display the now playing information within OBS, you will either need to add a new browser source and use the localhost url, or link to the `HTML` file, and allow CORS.

**LocalHost** - Recommended
1. Open OBS
2. Add New Source
3. Browser Source
4. Set URL to `http://localhost:8880/nowplaying` (If you have your own server you must allow CORS)
5. Set width to `650` for best results
6. Set height to  `400` for best results

**Directly to HTML** - Not Recommended
1. Open OBS
2. Add New Source
3. Browser Source
4. Check local file
5. Paste or browse for the full file path of the `index.html` file
5. Set width to `650` for best results
6. Set height to  `400` for best results

## Configuration
The website allows for customization, including colors, timing, and fonts. Below is an explanation of all configurable options.

```json
{
    "frequency": 500,
    "reconnectFrequency": 2000,
    "fadeDistance": 1,
    "fadeDuration": 2000,
    "colors": {
        "textColor": "auto",
        "progressColor": "auto",
        "progressAccent": "auto",
        "backgroundColor": "auto"
    },
    "font": "auto"
}
```

* frequency: The time in milliseconds between each update. 
    * Default: `500`. 
    * The lower the number the Smoother the changes, but the higher utilization.
* reconnectFrequency: The time in milliseconds between each reconnection attempt. 
    * Default `2000`.
    * This only affects if you are running the server separate from Beefweb.
* fadeDistance: Time in **seconds** from the end the fade will begin
    * Default: `1`
    * For a smooth transition the player will fade before the song has fully ended.
* fadeDuration: The total duration in milliseconds that the fade transition between songs will take
    * Default: `2000`
    * This should be double or more of the fadeDistance, allowing for a smooth fade between songs. If it is more or less than double, it will be offset.
* colors: An override for a constant color for any element.
    * Default: `auto`
    * Auto will be a dynamic color based on the current song. This accepts any [CSS Colors](https://www.w3schools.com/cssref/css_colors_legal.php):
        * Hexadecimal colors: `#FF0000`
        * Hexadecimal colors with transparency: `#FF0000FF`
        * RGB colors: `rgb(255,0,0)`
        * RGBA colors: `rgba(255,0,0,1)`
        * HSL colors: `hsl(0,100%,50%)`
        * HSLA colors: `hsla(0, 100.00%, 50.00%, 1)`
        * Predefined/Cross-browser color names: `red`
* font: An override for the font used in all places
    * Default: `auto`
    * The font must be installed on the machine, or is a default CSS fonts

