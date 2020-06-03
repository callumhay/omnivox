

class AudioVisUtils {

  static buildBinIndexLookup(numFreqs, numBins, gamma) {
    const binIndexLookup = {};
    for (let i = 0; i < numFreqs; i++) {
      let binIndex = Math.round(Math.pow(i/numFreqs, 1.0/gamma) * (numBins-1));
      if (binIndex in binIndexLookup) {
        binIndexLookup[binIndex].push(i);
      }
      else {
        binIndexLookup[binIndex] = [i];
      }
    }

    // Find gaps in the lookup and just have those gaps reference the previous (or next) bin's frequency(ies)
    for (let i = 0; i < numBins; i++) {
      if (i in binIndexLookup) {
        continue;
      }

      // Is there a previous bin?
      if (i-1 in binIndexLookup) {
        binIndexLookup[i] = binIndexLookup[i-1];
      }
      // Is there a next bin?
      else if (i+1 in binIndexLookup) {
        binIndexLookup[i] = binIndexLookup[i+1];
      }
      else {
        // This really shouldn't happen, it means there's a huge gap
        console.error("Big gap in frequency to mesh data, please find me and write code to fix this issue.");
      }
    }

    return binIndexLookup;
  }

  static calcFFTBinLevelSum(binIndices, fft) {
    let binLevel = 0;
    for (let i = 0; i < binIndices.length; i++) {
      binLevel += fft[binIndices[i]];
    }
    return binLevel;
  }
  static calcFFTBinLevelMax(binIndices, fft) {
    let binLevel = 0;
    for (let i = 0; i < binIndices.length; i++) {
      binLevel = Math.max(binLevel, fft[binIndices[i]]);
    }
    return binLevel;
  }

}

export default AudioVisUtils;