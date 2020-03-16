/*

Copyright (c) 2017 - Misaki Nakano - https://codepen.io/mnmxmx/pen/bRamej/

Permission is hereby granted, free of charge, to any person 
obtaining a copy of this software and associated documentation 
files (the "Software"), to deal in the Software without restriction,
 including without limitation the rights to use, copy, modify, 
merge, publish, distribute, sublicense, and/or sell copies of 
the Software, and to permit persons to whom the Software is 
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall 
be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
DEALINGS IN THE SOFTWARE.

*/
window.onload = () => {
  var visualizer = new Visualiser();

  window.onresize = () => {
    visualizer.resize();
  };
};


class Analyser {
  constructor(audio, smoothTime, color, scale, min, max, offset, radius, isAlpha) {
    this.audio = audio;
    this.visual = this.audio.visual;

    this.scale = scale;

    this.radius = radius;

    this.isAlpha = isAlpha;

    this.color = color;

    this.audioContext = this.audio.audioContext;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    // this.analyser.minDecibels = -60;
    // this.analyser.maxDecibels = 10;
    this.frequencyNum = 1024;
    this.hz = 22028;
    this.analyser.smoothingTimeConstant = smoothTime;

    this.filterLP = this.audioContext.createBiquadFilter();
    this.filterHP = this.audioContext.createBiquadFilter();

    // sourceNode.connect(this.gainNode);

    this.filterLP.type = "lowpass";
    this.filterLP.frequency.value = max;
    // this.filterLP.detune.value = 500;

    // this.filterHP.type = "highpass";
    // this.filterHP.frequency.value = 0;
    // this.filterHP.detune.value = 200;

    this.maxHz = max;
    this.minHz = min;

    this.offset = offset;
    this.radiusOffset = 16 * this.offset;
    this.count = 0;




    this.stockSpectrums = [];

    this.sourceStart = Math.ceil(this.frequencyNum * this.minHz / this.hz);
    this.sourceEnd = Math.round(this.frequencyNum * this.maxHz / this.hz);
    this.sourceLength = this.sourceEnd - this.sourceStart + 1;

    this.adjustOffset = Math.round(this.sourceLength * 0.12);

    this.distLength = 120;
    this.interval = (this.sourceLength - 1) / (this.distLength - 1);

    this.totalLength = Math.round(this.distLength * 3 / 2);
  }

  adjustFrequency(i, avr) {
    var f = Math.max(0, this.spectrums[this.sourceStart + i] - avr) * this.scale;
    var offset = i - this.sourceStart;

    var ratio = offset / this.adjustOffset;

    f *= Math.max(0, Math.min(1, 5 / 6 * (ratio - 1) * (ratio - 1) * (ratio - 1) + 1));
    // f *= Math.max(0, Math.min(1, -3 / 4 * Math.pow(Math.exp(-ratio), 6) + 1));

    return f;
  }

  update() {
    var spectrums = new Float32Array(this.frequencyNum);
    if (this.audio.isReady) {
      this.analyser.getFloatFrequencyData(spectrums);
      this.stockSpectrums.push(spectrums);
    }



    if (this.count < this.offset) {
      this.spectrums = new Float32Array(this.frequencyNum);
    } else {
      if (this.audio.isReady) {
        var _spectrums = this.stockSpectrums[0];

        if (!isFinite(_spectrums[0])) {
          this.spectrums = new Float32Array(this.frequencyNum);
        } else {
          this.spectrums = _spectrums;
        }

        this.stockSpectrums.shift();
      } else {
        this.spectrums = new Float32Array(this.frequencyNum);
      }
    }

    if (this.audio.isReady) {
      this.count++;
    }


    var canvasContext = this.visual.canvasContext;
    canvasContext.strokeStyle = this.color;
    canvasContext.fillStyle = this.color;
    // canvasContext.globalCompositeOperation = (this.isAlpha) ? "multiply" : "source-over";
    // canvasContext.globalAlpha = (this.isAlpha) ? 1 : 1;


    var avr = 0;

    for (var i = this.sourceStart; i <= this.sourceEnd; i++) {
      avr += this.spectrums[i];
    }

    avr /= this.sourceLength;

    avr = !this.audio.isReady || avr === 0 ? avr : Math.min(-40, Math.max(avr, -60));

    canvasContext.beginPath();

    var frequencyArray = [];

    for (var i = 0; i < this.distLength; i++) {
      var n1 = Math.floor(i * this.interval);
      var n2 = n1 + 1;
      var n0 = Math.abs(n1 - 1);
      var n3 = n1 + 2;


      n2 = n2 > this.sourceLength - 1 ? (this.sourceLength - 1) * 2 - n2 : n2;
      n3 = n3 > this.sourceLength - 1 ? (this.sourceLength - 1) * 2 - n3 : n3;

      var p0 = this.adjustFrequency(n0, avr);
      var p1 = this.adjustFrequency(n1, avr);
      var p2 = this.adjustFrequency(n2, avr);
      var p3 = this.adjustFrequency(n3, avr);

      var mu = i * this.interval - n1;

      var mu2 = mu * mu;

      var a0 = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
      var a1 = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      var a2 = -0.5 * p0 + 0.5 * p2;

      var targetFrequency = a0 * mu * mu2 + a1 * mu2 + a2 * mu + p1;
      targetFrequency = Math.max(0, targetFrequency);
      frequencyArray.push(targetFrequency);

      var pos = this.visual.calcPolorCoord((i + this.visual.tick + this.offset) / (this.totalLength - 1), this.radius + targetFrequency + 3);
      canvasContext.lineTo(pos.x + this.radiusOffset, pos.y + this.radiusOffset);
    };


    for (var i = 1; i <= this.distLength; i++) {
      var targetFrequency = frequencyArray[this.distLength - i];
      var pos = this.visual.calcPolorCoord((i / 2 + this.distLength - 1 + this.visual.tick + this.offset) / (this.totalLength - 1), this.radius + targetFrequency + 3);
      canvasContext.lineTo(pos.x + this.radiusOffset, pos.y + this.radiusOffset);
    }

    for (var i = this.distLength; i > 0; i--) {
      var targetFrequency = frequencyArray[this.distLength - i];
      var pos = this.visual.calcPolorCoord((i / 2 + this.distLength - 1 + this.visual.tick + this.offset) / (this.totalLength - 1), this.radius - targetFrequency - 3);
      canvasContext.lineTo(pos.x + this.radiusOffset, pos.y + this.radiusOffset);
    }


    for (var i = this.distLength - 1; i >= 0; i--) {
      var targetFrequency = frequencyArray[i];
      var pos = this.visual.calcPolorCoord((i + this.visual.tick + this.offset) / (this.totalLength - 1), this.radius - targetFrequency - 3);
      canvasContext.lineTo(pos.x + this.radiusOffset, pos.y + this.radiusOffset);
    }



    canvasContext.fill();



  }}


class Audio {
  constructor(_visual) {
    this.visual = _visual;
    this.audioContext = window.AudioContext ? new AudioContext() : new webkitAudioContext();
    this.fileReader = new FileReader();
    this.isReady = false;
    this.count = 0;
  }

  init() {

    this.analyser_1 = new Analyser(this, 0.7, "#224982", 5, 1, 600, 2, 460, true);

    this.analyser_2 = new Analyser(this, 0.82, "#30e3ca", 4.8, 1, 600, 0, 460, false);




    this.render();

    document.getElementById('file').addEventListener('change', function (e) {
      this.fileReader.readAsArrayBuffer(e.target.files[0]);
    }.bind(this));

    var _this = this;

    this.fileReader.onload = function () {
      _this.audioContext.decodeAudioData(_this.fileReader.result, function (buffer) {
        if (_this.source) {
          _this.source.stop();
        }
        _this.source = _this.audioContext.createBufferSource();
        _this.source.buffer = buffer;

        _this.source.loop = true;

        _this.connectNode(buffer);

        _this.isReady = true;
      });
    };
  }

  connectNode(buffer) {
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = buffer;

    this.source.loop = true;

    this.source.connect(this.analyser_1.analyser);

    this.source.connect(this.analyser_2.analyser);


    this.source.connect(this.audioContext.destination);
    this.source.start(0);
  }

  render() {
    this.visual.draw();

    requestAnimationFrame(this.render.bind(this));
  }}






class Visualiser {
  constructor() {
    this.canvas = document.getElementById('visualizer');
    this.canvasContext = this.canvas.getContext('2d');

    this.resize();

    //     this.particles = [];
    //     this.particleC = [
    //       "#ffea00"
    //     ];
    //     this.particleNum = 12;

    //     for(var i = 0; i < this.particleNum; i++){
    //       var color = this.particleC[Math.floor(Math.random() * this.particleC.length)];
    //       var particle = new Particle(this, color);
    //       this.particles[i] = particle;
    //     }

    this.circleR = 450;
    this.audio = new Audio(this);
    this.audio.init();
    this.tick = 0;
  }


  resize() {
    this.canvasW = this.canvas.width = window.innerWidth * 2;
    this.canvasH = this.canvas.height = window.innerHeight * 2;

    if (!this.particles) return;
    for (var i = 0; i < this.particleNum; i++) {
      this.particles[i].resize();
    }
  }

  calcPolorCoord(a, b) {
    var x = Math.cos(a * 2 * Math.PI) * b;
    var y = Math.sin(a * 2 * Math.PI) * b * 0.95;

    return { x: x, y: y };
  }

  draw() {
    this.tick += 0.07;
    var canvasContext = this.canvasContext;
    canvasContext.save();

    canvasContext.clearRect(0, 0, this.canvasW, this.canvasH);
    canvasContext.translate(this.canvasW / 2, this.canvasH / 2);


    // for(var i = 0; i < this.particleNum; i++){
    //   this.particles[i].update();
    // }


    canvasContext.lineWidth = 3;

    this.audio.analyser_1.update();
    this.audio.analyser_2.update();
    // this.audio.analyser_3.update();


    canvasContext.restore();
  }}




// class Particle{
//   constructor(visualiser, color){
//     this.visualiser = visualiser;

//     this.defaultR = 20 + 30 * Math.random();
//     this.defaultY = this.visualiser.canvasH / 2 + this.defaultR;
//     this.ratioX = Math.random() - 0.5;
//     this.defaultX = this.ratioX * 1000;

//     this.color = color;

//     this.initOffsetY = Math.random() * this.visualiser.canvasH;

//     this.r = this.defaultR;
//     this.x = this.defaultX;
//     this.y = this.defaultY + this.initOffsetY;

//     this.offsetX = 0;
//     this.timeScaleX = (Math.random() * 2 - 1) * Math.PI;

//     this.offsetR = Math.random() * 0.005

//     this.vy = 1 + 2 * Math.random();
//   }

//   resize(){
//     this.defaultY = this.visualiser.canvasH / 2 + this.defaultR;
//     // this.defaultX = this.ratioX * this.visualiser.canvasW;
//   }

//   update(){
//     this.tick = this.visualiser.tick;
//     var context = this.visualiser.canvasContext;
//     this.offsetX = Math.sin(this.tick * 0.2 + this.timeScaleX) * 150;
//     this.y -= this.vy;
//     this.r -= (0.03 + this.offsetR);
//     this.x = this.offsetX + this.defaultX;

//     this.reset();


//     context.fillStyle = this.color;
//     context.beginPath();
//     context.arc(this.x, this.y, this.r, 0, Math.PI * 2);
//     context.fill();
//   }

//   reset(){
//     if(this.r <= 0 || this.y < -this.visualiser.canvasH / 2 - this.defaultR){
//       this.offsetX = 0;
//       this.ratioX = Math.random() - 0.5;
//       this.defaultX = this.ratioX * 1000;
//       this.y = this.defaultY;
//       this.r = this.defaultR;
//     }
//   }
// }