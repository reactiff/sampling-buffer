import ClosedCircuitBuffer from "./ClosedCircuitBuffer";
import { BufferFilter, Expression, Sampler, SamplerOptions, TrackDictionary } from './types';

import { createSampler } from './createSampler';

import { value as valueOrDefault } from '.';
import Serie from "./Serie";

const noFilter = () => true;

class MultiTrackBuffer {  

  timer:          any;
  sampler:        Sampler;
  tracks:         TrackDictionary = {};
  sampling:       boolean         = false;
  
  // -- EVENTS 
  onTrackStart?:  (track: ClosedCircuitBuffer) => void;
  onInterval?:    () => void;
  
  constructor(options: SamplerOptions) {
    this.sampler = createSampler(options);
  }

  addExpression(name: string, expression: Expression) {
    this.sampler.addExpression(name, expression);
  }

  getTracks(filter?: BufferFilter) {
    return Object.entries(this.tracks)
      .filter(kv => (filter || (() => true))(kv[0], kv[1]))
      .map(kv => kv[1]);
  }
  
  startSampling() {
    if (this.sampler.suppressAutoSampling) return;
    if (this.sampling) return;
    
    const _instance = this;

    // timer for buffer group
    this.timer = setInterval(
      () => {
        _instance.sampler.tracks.forEach((_track) => {
          _track.nextSample('timer')
        })
        if (_instance.onInterval) {
          _instance.onInterval();
        }
      }, this.sampler.interval
    );

    this.sampling = true;
  }

  stopSampling() {
    clearInterval(this.timer);
    this.sampling = false;
  }

  preload(data: any, filter?: BufferFilter) {
    this.createDataTracks(data);
    Object.entries(this.tracks)
      .filter(kv => (filter || noFilter)(kv[0], kv[1]))
      .forEach(kv => kv[1].preload(data));
  }

  capture(data: any, filter?: BufferFilter) {
    this.createDataTracks(data);
    Object.entries(this.tracks)
      .filter(kv => (filter || noFilter)(kv[0], kv[1]))
      .forEach(kv => kv[1].capture(data));
  }

  createDataTracks(data: any) {
    const _instance = this;
    const sampler = this.sampler;
    const trackKey: string = sampler.trackKeys.map(
      pk => valueOrDefault(data[pk], '')
    ).join('.');
    if (!_instance.tracks[trackKey]) {
        const track = new ClosedCircuitBuffer(sampler.bufferLength, sampler);
        sampler.trackKeys.forEach(pk => {
          track.tags[pk] = data[pk];
        })
        track.key = trackKey;
        _instance.tracks[trackKey] = track;
        sampler.tracks.push(track);
        if (_instance.onTrackStart) {
          _instance.onTrackStart(track);
        }
        
    }
  }
}

export default MultiTrackBuffer;
