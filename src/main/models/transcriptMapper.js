// transcriptMapper.js
class TranscriptMapper {
    constructor(transcribeOutput) {
      /**
       * Initialize the mapper with AWS Transcribe JSON output.
       * @param {Object} transcribeOutput - The JSON output from AWS Transcribe
       */
      if (!transcribeOutput || !transcribeOutput.results || !transcribeOutput.results.items) {
        throw new Error('Invalid AWS Transcribe output format');
      }
      this.items = transcribeOutput.results.items;
      this.speakerLabels = transcribeOutput.results.speaker_labels?.segments || [];
      this.segments = this._processSegments();
    }
  
    _findSpeakerAtTime(timestamp) {
      /**
       * Find the speaker for a given timestamp
       * @param {number} timestamp - The time to check
       * @returns {string|null} Speaker label or null if not found
       */
      const speakerSegment = this.speakerLabels.find(
        segment => timestamp >= parseFloat(segment.start_time) && timestamp <= parseFloat(segment.end_time)
      );
      return speakerSegment ? speakerSegment.speaker_label : null;
    }
  
    _processSegments() {
      /**
       * Process the transcript items into word segments with timing information and speaker labels.
       * @returns {Array<Object>} List of segments with start time, end time, text, and speaker
       */
      const segments = [];
      let currentSegment = { text: [], startTime: null, endTime: null, speaker: null };
  
      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        
        // Handle punctuation marks
        if (item.type !== 'pronunciation') {
          if (currentSegment.text.length > 0) {
            // For punctuation, append directly to the last word without space
            const lastWord = currentSegment.text[currentSegment.text.length - 1];
            currentSegment.text[currentSegment.text.length - 1] = lastWord + item.alternatives[0].content;
          }
          continue;
        }
  
        const currentTime = parseFloat(item.start_time);
        const currentSpeaker = this._findSpeakerAtTime(currentTime);
  
        // Start new segment if this is the first word or if the speaker changed
        if (currentSegment.startTime === null || (currentSpeaker && currentSpeaker !== currentSegment.speaker)) {
          if (currentSegment.text.length > 0) {
            segments.push({
              ...currentSegment,
              text: currentSegment.text.join(' ')
            });
          }
          currentSegment = {
            text: [],
            startTime: currentTime,
            endTime: null,
            speaker: currentSpeaker
          };
        }
  
        currentSegment.endTime = parseFloat(item.end_time);
        currentSegment.text.push(item.alternatives[0].content);
  
        // Start new segment at punctuation or after certain duration
        if (this._isSegmentBreak(item, i)) {
          // Add the punctuation to the current segment before starting a new one
          const nextItem = this.items[i + 1];
          if (nextItem && nextItem.type === 'punctuation') {
            const lastWord = currentSegment.text[currentSegment.text.length - 1];
            currentSegment.text[currentSegment.text.length - 1] = lastWord + nextItem.alternatives[0].content;
          }
          
          currentSegment.text = currentSegment.text.join(' ');
          segments.push({ ...currentSegment });
          currentSegment = { text: [], startTime: null, endTime: null };
        }
      }
  
      // Add final segment if exists
      if (currentSegment.text.length > 0) {
        currentSegment.text = currentSegment.text.join(' ');
        segments.push(currentSegment);
      }
  
      return segments;
    }
  
    _isSegmentBreak(item, index) {
      /**
       * Determine if a new segment should start after this item.
       * @param {Object} item - Transcript item
       * @param {number} index - Current item index
       * @returns {boolean} True if should break segment, False otherwise
       */
      if (index >= this.items.length - 1) {
        return true;
      }
  
      const nextItem = this.items[index + 1];
  
      // Break on punctuation
      if (
        nextItem.type === 'punctuation' &&
        ['.', '?', '!'].includes(nextItem.alternatives[0].content)
      ) {
        return true;
      }
  
      // Break on long pauses (>0.5s)
      if (
        nextItem.type === 'pronunciation' &&
        parseFloat(nextItem.start_time) - parseFloat(item.end_time) > 0.5
      ) {
        return true;
      }
  
      return false;
    }
  
    getTextAtTime(timestamp) {
      /**
       * Get the transcript text and speaker at a specific video timestamp.
       * @param {number} timestamp - Video timestamp in seconds
       * @returns {Object} Object containing text and speaker at that timestamp
       */
      for (const segment of this.segments) {
        if (segment.startTime <= timestamp && timestamp <= segment.endTime) {
          return {
            text: segment.text,
            speaker: segment.speaker
          };
        }
      }
      return {
        text: '',
        speaker: null
      };
    }
  
    getTimestampForText(searchText) {
      /**
       * Find the timestamp range for specific text in the transcript.
       * @param {string} searchText - Text to search for
       * @returns {[number, number]} Start and end timestamps in seconds
       */
      searchText = searchText.toLowerCase();
      for (const segment of this.segments) {
        if (segment.text.toLowerCase().includes(searchText)) {
          return [segment.startTime, segment.endTime];
        }
      }
      return [null, null];
    }
  
    getAllTimestampedText() {
      /**
       * Get all text segments with their timestamps.
       * @returns {Array<Object>} Array of objects containing text, startTime, and endTime
       */
      return this.segments.map(segment => ({
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        speaker: segment.speaker
      }));
    }
  }
  
  module.exports = TranscriptMapper;