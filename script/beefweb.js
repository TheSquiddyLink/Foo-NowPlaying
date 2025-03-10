const STATUS = {
    online: 1,
    offline: 0,
}

class BeefWeb {

    /**@private */
    status = STATUS.offline

    /**@private */
    options = {
        player: "/player",
        artwork: "/artwork/current",
        queue: "/playqueue"
    }

    /**@private */
    columns = [
        "%isplaying%",
        "%ispaused%",
        "%album artist%",
        "%album%",
        "%artist%",
        "%title%",
        "%track number%",
        "%length_seconds%",
        "%playback_time_seconds%",
        "%path%",
    ]

    /**@private */
    previousItem = new Item();

    /**@private */
    activeItem = new Item();

    frequency = 500;

    reconnectFrequency = 2000;

    fadeDistance = 1;

    fadeDuration = 2000;

    /**@private */
    mainWorker = new Worker("./script/worker.js");

    /**@private */
    queueWorker = new Worker("./script/worker.js");

    font = "auto";

    /**@private */
    elements = {
        player: new MyElement(),
        data: {
            albumArt: new MyElement(),
            title: new MyElement(),
            artist: new MyElement(),
            album: new MyElement(),
            container: new MyElement()
        },
        progress: {
            current: new MyElement(),
            total: new MyElement(),
            bar: new MyElement(),
            container: new MyElement(),
        }
    }

    type = "normal"
    /**@private */
    colorThief = new ColorThief();
    colorOverrides = {
        count: 0,
        values: {
            textColor: "auto",
            progressColor: "auto",
            progressAccent: "auto",
            backgroundColor: "auto",
        }
    }

    /**
     * @type {Array<Item>}
     * @private
     */
    playQueue = []

    constructor(port){
        this.port = port
        this.root = "http://localhost:" + port + "/api"
    }

    /**@private */
    getColumnsQuery() {
        return `?columns=${this.columns.join(",")}`;
    }
    
    /**
     * 
     * @param {MessageEvent<any>} event 
     * @private
     */
    async update(event){
        if (!event || !event.data || !event.data.player?.activeItem) return;
        try {
            this.activeItem.update(event.data);
        } catch (event) {
            this.status = STATUS.offline;
        }
        
        if(!this.validate()){
            this.elements.player.element.style.opacity = 0;
        } else if(this.compareAll()){
            console.log("No changes detected");
            this.elements.player.element.style.opacity = 1;
        } else if(this.compareTrack()){
            console.log("Only time changed");
            this.elements.player.element.style.opacity = 1;
            this.updateTime();
        } else {
            console.log("Track changed");
            this.elements.player.element.style.opacity = 1;
            this.updateAll();
        }

        if(this.validate() && this.type == "normal" && this.activeItem.time.current >= this.activeItem.time.total - this.fadeDistance){
            this.fade()
        }

        this.previousItem.from(this.activeItem);
    }

    validate(){
        return this.activeItem.playbackState != "stopped";
    }

    start(){
        console.log("Starting")
        if(this.status == STATUS.offline) return;
        this.mainWorker.postMessage({
            url: this.root + this.options.player + this.getColumnsQuery(),
            interval: this.frequency
        });
        console.log(this.activeItem)
       
        this.mainWorker.onmessage = this.update.bind(this);
        this.bindAll()
        this.updateAll();
    }

    /**@private */
    bindAll(){
        this.elements.data.title.bind(this.activeItem.columns, "title", "text")
        this.elements.data.artist.bind(this.activeItem.columns, "artist", "text" )
        this.elements.data.album.bind(this.activeItem.columns, "album",  "text")
    }

    async init() {
        await this.loadConfig();
        
        this.elements.player.setElement(document.getElementById("player"));
        this.type = this.elements.player.element.getAttribute("type") ?? this.type;
        
        console.log(this.type);
    
        const elementMappings = {
            data: {
                albumArt: "playerArt",
                title: "playerTitle",
                artist: "playerArtist",
                album: "playerAlbum",
                container: "playerData"
            },
            progress: {
                current: "progressCurrent",
                total: "progressTotal",
                bar: "progressBar",
                container: "progressBarContainer"
            }
        };
    
        for (const [category, elements] of Object.entries(elementMappings)) {
            for (const [key, id] of Object.entries(elements)) {
                this.elements[category][key].setElement(document.getElementById(id));
            }
        }

        if(this.font && this.font !== "auto") this.elements.player.setStyle("font-family", this.font)
    
        await this.connect()
        if(this.status == STATUS.offline){
            console.log("Attempting to reconnect")
            this.reconnectInterval  = setInterval(async () => {
                await this.connect();
                if(this.status == STATUS.online){
                    clearInterval(this.reconnectInterval)
                    console.log("Back online!")
                    this.start();
                }
            },this.reconnectFrequency)
        }
        if(this.elements.data.albumArt.element){
            this.elements.data.albumArt.element.onerror = () => {
                this.elements.data.albumArt.setAttribute("src", "./assets/unknown.png"); // Set your placeholder image path
            };
        }
     
        if(this.elements.player) this.elements.player.element.addEventListener("animationend", () => this.elements.player.setStyle("animation","none"))
    }

    /**
     * @private
     */
    async loadConfig(){
        const response = await fetch('./config.json');
        const data = await response.json();

        this.frequency = data.frequency;
        this.reconnectFrequency = data.reconnectFrequency;
        this.fadeDistance = data.fadeDistance;
        this.fadeDuration = data.fadeDuration;

        this.colorOverrides.values = data.colors;
        let count = 0;
        for(let value of Object.values(this.colorOverrides.values)){
            if(value != "auto") count+=1;
        }
        this.colorOverrides.count = count;

        this.font = data.font;
    }
    async connect(){
        console.log("Connecting: ", this.activeItem)
        try {
            await this.update({data: await ((await fetch(this.root+this.options.player)).json())});
        } catch (error){
            this.status = STATUS.offline;
            return;
        }
        this.status = STATUS.online
    }
    
    /**@private */
    updateAll(){
       
        this.elements.data.albumArt.setAttribute("src", this.root + this.options.artwork + "?a=" + new Date().getTime());

        if(this.elements.player && this.elements.player.element.style.animation != this.getAnimation()) this.fade();
        this.checkLength();
        this.getCommonColor();
        this.updateTime();
    }

    /**@private */
    updateTime(){
        this.elements.progress.current.setText(this.formatTime(this.activeItem.time.current));
        this.elements.progress.total.setText(this.formatTime(this.activeItem.time.total));
        this.elements.progress.bar.setStyle("width", this.activeItem.time.percent()+"%")

        this.elements.player.setStyle("backgroundColor", this.activeItem.backgroundColor)
        this.elements.player.setStyle("color", this.activeItem.textColor);
        
        this.elements.progress.container.setStyle("backgroundColor", this.activeItem.progressAccent);

        this.elements.progress.bar.setStyle("backgroundColor", this.activeItem.progressColor)
    }

    /**@private */
    compareAll(){
        return this.activeItem.compareAll(this.previousItem);
    }

    /**@private */
    compareTrack() {
        return this.activeItem.compareTrack(this.previousItem);
    }

    /**@private */
    formatTime(seconds){
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`; 
    }

    /**@private */
    getCommonColor(){
        if (Object.values(this.colorOverrides.values).every(color => color !== "auto")) {
            console.log("All set");
            Object.assign(this.activeItem, this.colorOverrides.values);
            return;
        }        
        console.log("Getting color")
        const onLoad = (img) => {
            try {
                this.activeItem.setColor(this.colorThief.getPalette(img,4));

            } catch (error) {
                console.error(error);
            }
            if(this.colorOverrides.count > 0){
                Object.keys(this.colorOverrides.values).forEach((key) => {
                    let value = this.colorOverrides.values[key];
                    if (value && value !== "auto") {
                        this.activeItem[key] = this.colorOverrides.values[key];
                    }
                });       
            }
              
        }
        const img = this.elements.data.albumArt.element;
        if(!img) return
        img.crossOrigin = "anonymous";
        if (img.complete) {
            onLoad(img);
        } else {
            img.addEventListener('load', function() {
                onLoad(img);
            });
        }
    }

    /**@private */
    fade(){
        this.elements.player.setStyle("animation", this.getAnimation());
    }


    getAnimation(){
        switch(this.type){
            case "normal":
                return `fade ${this.fadeDuration}ms`
            case "notification":
                return `fadeInverse ${this.fadeDuration*2}ms`
        }
    }

    /**
     * 
     * @param {?HTMLElement} element
     */
    checkLength(element) {
        if(!element){
            console.log("Defaulting")
            this.checkLength(this.elements.data.album.element)
            this.checkLength(this.elements.data.title.element)
            this.checkLength(this.elements.data.artist.element)
            return;
        }
        console.log("Checking Length")
        console.log(element)
        const max = this.elements.data.container.element.offsetWidth;
        const current = element.offsetWidth;
        console.log(max, current)
        if(current > max){
            element.classList.add("scrolling")
        } else {
            element.classList.remove("scrolling")
        }
    }   

    startQueue(){
        if(this.status == STATUS.offline) return;
        this.queueWorker.postMessage({
            url: this.root + this.options.queue + this.getColumnsQuery(),
            interval: this.frequency
        })
        this.queueWorker.onmessage = this.updateQueue.bind(this);
    }

    updateQueue(data){
        console.log(data.data)
    }

    
}

class Item {
    constructor(data) {
        this.playlist = {};
        this.time = {
            current: 0,
            total: 0,
            percent: () => (this.time.current / this.time.total) * 100
        };
        this.columns = {};
        if(data) this.update(data);
        this.color = null;
        this.allColors = [];
        this.textColor = "black"
        this.progressColor = "black"
        this.progressAccent = "black"
        this.backgroundColor = "black"
    }


    /**
     * 
     * @param {Array<[number,number,number]>} colors
     */
    setColor(colors){

        const color = colors.length > 0 ? colors[0] : [128, 128, 128];
        this.allColors = colors.map((item) => `rgb(${item.join(",")})`);
        this.color = `rgb(${color.join(",")})`;
        this.backgroundColor = this.allColors[0]
        this.textColor = this.allColors[1]
        this.progressColor = this.allColors[1]
        this.progressAccent = this.allColors[2];
    }
    


    /**
     * Converts an RGB color to HSL.
     * @param {number} r Red (0-255)
     * @param {number} g Green (0-255)
     * @param {number} b Blue (0-255)
     * @returns {[number, number, number]} HSL values [hue (0-360), saturation (0-100), lightness (0-100)]
     * @private
     * @deprecated
     */
    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h *= 60;
            s *= 100;
        }
        return [h, s, l];
    }

    update(data) {
        if (!data?.player?.activeItem) return;
        let activeItem = data.player.activeItem;

        this.playlist.id = activeItem.playlistId;
        this.playlist.index = activeItem.playlistIndex;
        this.songIndex = activeItem.index;

        // Store previous values
        const previousValues = {
            time: {
                current: this.time.current,
                total: this.time.total
            },
            columns: {
                isPlaying: this.columns.isPlaying,
                isPaused: this.columns.isPaused,
                albumArtist: this.columns.albumArtist,
                album: this.columns.album,
                artist: this.columns.artist,
                title: this.columns.title,
                trackNumber: this.columns.trackNumber,
                length: this.columns.length,
                elapsed: this.columns.elapsed,
                path: this.columns.path
            }
        };

        // Update values with fallback to previous ones if invalid
        this.time.current = activeItem.position ?? previousValues.time.current;
        this.time.total = activeItem.duration ?? previousValues.time.total;

        this.columns.isPlaying = activeItem.columns?.[0] ?? previousValues.columns.isPlaying;
        this.columns.isPaused = activeItem.columns?.[1] ?? previousValues.columns.isPaused;
        this.columns.albumArtist = activeItem.columns?.[2] ?? previousValues.columns.albumArtist;
        this.columns.album = activeItem.columns?.[3] ?? previousValues.columns.album;
        this.columns.artist = activeItem.columns?.[4] ?? previousValues.columns.artist;
        this.columns.title = activeItem.columns?.[5] ?? previousValues.columns.title;
        this.columns.trackNumber = activeItem.columns?.[6] ?? previousValues.columns.trackNumber;
        this.columns.length = activeItem.columns?.[7] ?? previousValues.columns.length;
        this.columns.elapsed = activeItem.columns?.[8] ?? previousValues.columns.elapsed;
        this.columns.path = activeItem.columns?.[9] ?? previousValues.columns.path;

        this.playbackState = data.player.playbackState;
    }

    /**
     * 
     * @param {Item} item 
     */
    from(item) {
        Object.assign(this.playlist, item.playlist);
        Object.assign(this.time, item.time);
        Object.assign(this.columns, item.columns);
        this.color = item.color;
        this.songIndex = item.songIndex;
    }

    /**
     * @param {Item} item 
     * @returns {boolean}
     */
    compareAll(item) {
        if (!(this instanceof Item) || !(item instanceof Item)) return false;
        
        return (
            this.songIndex === item.songIndex &&
            this.time.current === item.time.current &&
            this.time.total === item.time.total &&
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album &&
            this.columns.isPlaying === item.columns.isPlaying
        );
    }

    /**
     * 
     * @param {Item} item 
     * @returns {boolean}
     */
    compareTrack(item) {
        return (
            this.columns.title === item.columns.title &&
            this.columns.artist === item.columns.artist &&
            this.columns.album === item.columns.album &&
            this.color === item.color
        )
    }
    
}

class MyElement {


    /**
     * @type {?HTMLElement}
     */
    element;

    binds = {}
    /**
     * 
     * @param {HTMLElement} element 
     */
    setElement(element){
        this.element = element;
    }

    /**
     * Binds a variable to an attribute, text, or style property.
     * @param {object} obj - The object containing the property.
     * @param {string} key - The property name to bind.
     * @param {string} type - The type of binding ('attribute', 'text', 'style').
     * @param {string} target - The target attribute/property name.
     * 
     */
    bind(obj, key, type, target) {
        this.binds[key] = obj[key]; // Save original reference

        Object.defineProperty(obj, key, {
            get: () => this.binds[key],
            set: (newValue) => {
                this.binds[key] = newValue;
                if (type === "attribute") {
                    this.setAttribute(target, newValue);
                } else if (type === "text") {
                    this.setText(newValue);
                } else if (type === "style") {
                    this.setStyle(target, newValue);
                }
            },
            configurable: true
        });

        // Initialize the binding with the current value
        if (type === "attribute") {
            this.setAttribute(target, obj[key]);
        } else if (type === "text") {
            this.setText(obj[key]);
        } else if (type === "style") {
            this.setStyle(target, obj[key]);
        }
    }
    /**
     * @param {string} attribute 
     * @param {*} value 
     */
    setAttribute(attribute, value){
        if(this.element) this.element.setAttribute(attribute, value)
    }
    /**
     * @param {*} value 
     */
    setText(value){
        if(this.element) this.element.innerHTML = value;
    }

    /**
     * @param {string} property 
     * @param {*} value 
     */
    setStyle(property, value){
        if(this.element) this.element.style[property] = value;
    }
}
