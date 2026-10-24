/**
 * WhopClip Studio — WebAudio API Mixer, Procedural Music Synth & Viral Waveform Analyzer
 * Provides:
 *  1. Real WebAudio API Mixer connecting HTML5 <video> (main + B-roll) and procedural audio
 *     into both speakers and a `MediaStreamAudioDestinationNode` for MediaRecorder export.
 *  2. Procedural WebAudio Background Music Beds ('phonk-drive', 'lofi-chill', 'tension-riser', 'none')
 *     plus viral transition SFX ('whoosh', 'ding', 'bass-drop', 'cash') and subtle demo voice cadence.
 *  3. Deterministic & File-based Audio Waveform, Silence Map & Viral Moment Analyzer
 *     (`analyzeVideoBufferOrDemo(videoFileOrPreset)`) with 160 normalized amplitude bars,
 *     silence intervals for auto-skip, and frame-accurate word-level karaoke timestamps.
 *
 * Attached to `window.WhopAudioEngine` for zero-bundler browser usage.
 */
(function (global) {
  'use strict';

  const MUSIC_PRESETS = [
    { id: 'none', name: 'No Background Sound', bpm: 0, style: 'Pure Clean Speech (Default)' },
    { id: 'phonk-drive', name: 'Drift Phonk 808', bpm: 140, style: 'High-Retention Hustle' },
    { id: 'lofi-chill', name: 'Lofi Rhodes Beat', bpm: 84, style: 'Storytelling / Founder' },
    { id: 'tension-riser', name: 'Dark Tension Pulse', bpm: 118, style: 'Algorithm Hook Riser' }
  ];

  // Rich word-by-word scripts for the 3 built-in demo streams (60s total per stream, 4 clips each)
  const DEMO_SCRIPTS = {
    'podcast-millionaire': {
      duration: 60,
      silences: [
        { start: 5.4, end: 6.4, duration: 1.0, label: 'Breath Pause (-1.0s)' },
        { start: 14.3, end: 15.5, duration: 1.2, label: 'Dead Air Gap (-1.2s)' },
        { start: 25.8, end: 27.0, duration: 1.2, label: 'Mic Adjustment (-1.2s)' },
        { start: 38.2, end: 39.4, duration: 1.2, label: 'Dramatic Pause (-1.2s)' },
        { start: 49.0, end: 50.2, duration: 1.2, label: 'Room Silence (-1.2s)' }
      ],
      clips: [
        {
          id: 'clip-pm-1',
          title: 'How 19-Year-Old Clippers Make $12k/Mo on Whop',
          start: 0.0,
          end: 14.3,
          score: 99,
          hookScore: 99,
          pacingScore: 97,
          retentionScore: 98,
          tag: '🔥 #1 VIRAL HOOK',
          reason: 'Immediate $12k/mo financial curiosity gap + contrarian claim in first 2.4 seconds.',
          segments: [
            {
              start: 0.1,
              end: 5.3,
              words: [
                { w: 'Teenagers', e: '🤯' },
                { w: 'are' },
                { w: 'quietly' },
                { w: 'making' },
                { w: 'twelve', e: '💰' },
                { w: 'thousand', e: '💵' },
                { w: 'dollars' },
                { w: 'a' },
                { w: 'month' },
                { w: 'clipping' },
                { w: 'podcasts', e: '🎙️' },
                { w: 'on' },
                { w: 'Whop.' }
              ]
            },
            {
              start: 6.5,
              end: 14.2,
              words: [
                { w: 'Zero', e: '🚫' },
                { w: 'camera,' },
                { w: 'zero' },
                { w: 'followers,' },
                { w: 'just' },
                { w: 'slicing', e: '✂️' },
                { w: 'thirty' },
                { w: 'second' },
                { w: 'viral', e: '🚀' },
                { w: 'hooks' },
                { w: 'that' },
                { w: 'print' },
                { w: 'bounty' },
                { w: 'payouts', e: '💸' },
                { w: 'every' },
                { w: 'single' },
                { w: 'week!' }
              ]
            }
          ]
        },
        {
          id: 'clip-pm-2',
          title: 'The Split-Screen Dopamine Formula Explained',
          start: 15.5,
          end: 30.2,
          score: 95,
          hookScore: 94,
          pacingScore: 96,
          retentionScore: 95,
          tag: '⚡ HIGH RETENTION',
          reason: 'Breaks down the exact 50/50 split-screen B-roll mechanic that locks viewer eyeballs.',
          segments: [
            {
              start: 15.6,
              end: 25.7,
              words: [
                { w: 'Here' },
                { w: 'is' },
                { w: 'the' },
                { w: 'secret', e: '🔑' },
                { w: 'formula:' },
                { w: 'put' },
                { w: 'high' },
                { w: 'status' },
                { w: 'podcast' },
                { w: 'alpha', e: '🧠' },
                { w: 'on' },
                { w: 'top,' },
                { w: 'and' },
                { w: 'satisfying' },
                { w: 'Minecraft', e: '⛏️' },
                { w: 'parkour' },
                { w: 'right' },
                { w: 'underneath.' }
              ]
            },
            {
              start: 27.1,
              end: 30.1,
              words: [
                { w: 'Your' },
                { w: 'viewer' },
                { w: 'retention', e: '📈' },
                { w: 'literally' },
                { w: 'doubles' },
                { w: 'overnight!', e: '🔥' }
              ]
            }
          ]
        },
        {
          id: 'clip-pm-3',
          title: 'Why Creators Pay $3 Per 1,000 Views in Bounties',
          start: 30.4,
          end: 45.0,
          score: 92,
          hookScore: 90,
          pacingScore: 93,
          retentionScore: 92,
          tag: '💰 BOUNTY MATH',
          reason: 'Concrete CPM math ($3 per 1,000 views) triggers high saves and shares.',
          segments: [
            {
              start: 30.5,
              end: 38.1,
              words: [
                { w: 'Top' },
                { w: 'creators', e: '👑' },
                { w: 'pay' },
                { w: 'three' },
                { w: 'dollars', e: '💵' },
                { w: 'for' },
                { w: 'every' },
                { w: 'thousand' },
                { w: 'views' },
                { w: 'you' },
                { w: 'generate' },
                { w: 'on' },
                { w: 'TikTok' },
                { w: 'and' },
                { w: 'Shorts.' }
              ]
            },
            {
              start: 39.5,
              end: 44.9,
              words: [
                { w: 'Hit' },
                { w: 'four' },
                { w: 'million' },
                { w: 'views', e: '👁️' },
                { w: 'this' },
                { w: 'month' },
                { w: 'and' },
                { w: 'that' },
                { w: 'is' },
                { w: 'twelve' },
                { w: 'grand', e: '🏆' },
                { w: 'wired' },
                { w: 'straight' },
                { w: 'to' },
                { w: 'you.' }
              ]
            }
          ]
        },
        {
          id: 'clip-pm-4',
          title: 'Kill Dead Air Or Die In The Algorithm',
          start: 45.2,
          end: 59.8,
          score: 89,
          hookScore: 88,
          pacingScore: 92,
          retentionScore: 87,
          tag: '✂️ PACING HACK',
          reason: 'Urgent editing advice with strong call-to-action cadence.',
          segments: [
            {
              start: 45.3,
              end: 48.9,
              words: [
                { w: 'One' },
                { w: 'second' },
                { w: 'of' },
                { w: 'dead', e: '💀' },
                { w: 'air' },
                { w: 'kills' },
                { w: 'your' },
                { w: 'entire' },
                { w: 'clip.' }
              ]
            },
            {
              start: 50.3,
              end: 59.6,
              words: [
                { w: 'Strip' },
                { w: 'every' },
                { w: 'breath', e: '⚡' },
                { w: 'pause,' },
                { w: 'punch' },
                { w: 'the' },
                { w: 'zoom,' },
                { w: 'burn' },
                { w: 'neon' },
                { w: 'captions,', e: '✨' },
                { w: 'and' },
                { w: 'ship' },
                { w: 'ten' },
                { w: 'bounty' },
                { w: 'shorts' },
                { w: 'a' },
                { w: 'day!', e: '🚀' }
              ]
            }
          ]
        }
      ]
    },

    'streamer-alpha': {
      duration: 60,
      silences: [
        { start: 5.2, end: 6.3, duration: 1.1, label: 'Chat Reaction Pause (-1.1s)' },
        { start: 14.0, end: 15.2, duration: 1.2, label: 'Dead Air Gap (-1.2s)' },
        { start: 25.5, end: 26.8, duration: 1.3, label: 'Chair Spin Gap (-1.3s)' },
        { start: 38.0, end: 39.2, duration: 1.2, label: 'Mic Mute Beat (-1.2s)' },
        { start: 48.8, end: 50.0, duration: 1.2, label: 'Silence Drop (-1.2s)' }
      ],
      clips: [
        {
          id: 'clip-sa-1',
          title: 'LIVE: The 0.8-Second Algorithm Hook Nobody Talks About',
          start: 0.0,
          end: 14.0,
          score: 98,
          hookScore: 99,
          pacingScore: 98,
          retentionScore: 96,
          tag: '⚡ 98% VIRAL SCORE',
          reason: 'Explosive streamer energy + pattern interrupt in the opening 0.8 seconds.',
          segments: [
            {
              start: 0.1,
              end: 5.1,
              words: [
                { w: 'STOP', e: '🛑' },
                { w: 'SCROLLING!' },
                { w: 'Chat,' },
                { w: 'listen' },
                { w: 'up', e: '🔊' },
                { w: 'because' },
                { w: 'nobody' },
                { w: 'is' },
                { w: 'telling' },
                { w: 'you' },
                { w: 'this' },
                { w: 'algorithm', e: '🤖' },
                { w: 'glitch!' }
              ]
            },
            {
              start: 6.4,
              end: 13.9,
              words: [
                { w: 'If' },
                { w: 'your' },
                { w: 'first' },
                { w: 'frame' },
                { w: 'does' },
                { w: 'not' },
                { w: 'move', e: '💥' },
                { w: 'in' },
                { w: 'point' },
                { w: 'eight' },
                { w: 'seconds,' },
                { w: 'TikTok' },
                { w: 'buries', e: '📉' },
                { w: 'your' },
                { w: 'video' },
                { w: 'forever!' }
              ]
            }
          ]
        },
        {
          id: 'clip-sa-2',
          title: 'How My Top Clipper Made $4,200 From One Stream',
          start: 15.2,
          end: 29.8,
          score: 96,
          hookScore: 95,
          pacingScore: 97,
          retentionScore: 95,
          tag: '💎 STREAM BOUNTY',
          reason: 'Real social proof of a single stream clip generating a $4,200 Whop bounty.',
          segments: [
            {
              start: 15.3,
              end: 25.4,
              words: [
                { w: 'Last' },
                { w: 'night' },
                { w: 'one' },
                { w: 'clipper', e: '✂️' },
                { w: 'in' },
                { w: 'my' },
                { w: 'Whop' },
                { w: 'bounty' },
                { w: 'took' },
                { w: 'a' },
                { w: 'twenty' },
                { w: 'second' },
                { w: 'rage', e: '🔥' },
                { w: 'moment' },
                { w: 'and' },
                { w: 'dropped' },
                { w: 'Subway' },
                { w: 'Surfers', e: '🛹' },
                { w: 'below' },
                { w: 'it.' }
              ]
            },
            {
              start: 26.9,
              end: 29.7,
              words: [
                { w: 'Boom:', e: '💣' },
                { w: 'four' },
                { w: 'thousand' },
                { w: 'dollars', e: '💸' },
                { w: 'paid' },
                { w: 'out!' }
              ]
            }
          ]
        },
        {
          id: 'clip-sa-3',
          title: 'Why Drift Phonk + Karaoke Captions Lock Brain Cells',
          start: 30.0,
          end: 45.0,
          score: 93,
          hookScore: 92,
          pacingScore: 95,
          retentionScore: 91,
          tag: '🎵 AUDIO SECRET',
          reason: 'Explains audio-visual synchronization using phonk bass and word-by-word pop.',
          segments: [
            {
              start: 30.1,
              end: 37.9,
              words: [
                { w: 'Layer' },
                { w: 'drift' },
                { w: 'phonk', e: '🎵' },
                { w: 'under' },
                { w: 'my' },
                { w: 'voice' },
                { w: 'at' },
                { w: 'minus' },
                { w: 'twelve' },
                { w: 'decibels' },
                { w: 'so' },
                { w: 'every' },
                { w: 'word' },
                { w: 'hits', e: '⚡' },
                { w: 'like' },
                { w: 'a' },
                { w: 'movie.' }
              ]
            },
            {
              start: 39.3,
              end: 44.9,
              words: [
                { w: 'Chat' },
                { w: 'cannot' },
                { w: 'swipe', e: '🔒' },
                { w: 'away' },
                { w: 'when' },
                { w: 'every' },
                { w: 'syllable' },
                { w: 'flashes' },
                { w: 'gold!', e: '✨' }
              ]
            }
          ]
        },
        {
          id: 'clip-sa-4',
          title: 'Clip This Right Now & Claim The Whop Bounty',
          start: 45.2,
          end: 59.8,
          score: 90,
          hookScore: 91,
          pacingScore: 90,
          retentionScore: 89,
          tag: '🚀 CALL TO CLIP',
          reason: 'Direct fourth-wall break challenging viewers and clippers to clip the moment.',
          segments: [
            {
              start: 45.3,
              end: 48.7,
              words: [
                { w: 'Clip' },
                { w: 'this' },
                { w: 'exact', e: '🎯' },
                { w: 'thirty' },
                { w: 'seconds' },
                { w: 'right' },
                { w: 'now!' }
              ]
            },
            {
              start: 50.1,
              end: 59.6,
              words: [
                { w: 'Export' },
                { w: 'in' },
                { w: 'nine' },
                { w: 'sixteen', e: '📱' },
                { w: 'vertical,' },
                { w: 'post' },
                { w: 'it' },
                { w: 'to' },
                { w: 'Reels' },
                { w: 'and' },
                { w: 'Shorts,' },
                { w: 'and' },
                { w: 'collect', e: '💰' },
                { w: 'your' },
                { w: 'Whop' },
                { w: 'bag', e: '👑' },
                { w: 'today!' }
              ]
            }
          ]
        }
      ]
    },

    'founder-breakdown': {
      duration: 60,
      silences: [
        { start: 5.5, end: 6.6, duration: 1.1, label: 'Keynote Pause (-1.1s)' },
        { start: 14.4, end: 15.6, duration: 1.2, label: 'Slide Transition (-1.2s)' },
        { start: 26.0, end: 27.2, duration: 1.2, label: 'Breath Gap (-1.2s)' },
        { start: 38.4, end: 39.6, duration: 1.2, label: 'Data Beat (-1.2s)' },
        { start: 49.2, end: 50.4, duration: 1.2, label: 'Silence Trim (-1.2s)' }
      ],
      clips: [
        {
          id: 'clip-fb-1',
          title: 'Why 99% of Short-Form Editors Fail in 3 Seconds',
          start: 0.0,
          end: 14.4,
          score: 97,
          hookScore: 98,
          pacingScore: 95,
          retentionScore: 98,
          tag: '📊 DATA HOOK',
          reason: 'Hard telemetry stat (99% fail in 3s) backed by visual retention curve.',
          segments: [
            {
              start: 0.1,
              end: 5.4,
              words: [
                { w: 'We' },
                { w: 'analyzed' },
                { w: 'ten' },
                { w: 'thousand', e: '📊' },
                { w: 'short' },
                { w: 'form' },
                { w: 'videos' },
                { w: 'and' },
                { w: 'ninety-nine', e: '⚠️' },
                { w: 'percent' },
                { w: 'fail' },
                { w: 'in' },
                { w: 'three' },
                { w: 'seconds.' }
              ]
            },
            {
              start: 6.7,
              end: 14.3,
              words: [
                { w: 'Why?' },
                { w: 'Because' },
                { w: 'traditional' },
                { w: 'editors' },
                { w: 'leave' },
                { w: 'dead', e: '🔇' },
                { w: 'air' },
                { w: 'at' },
                { w: 'the' },
                { w: 'start' },
                { w: 'and' },
                { w: 'use' },
                { w: 'zero', e: '📉' },
                { w: 'visual' },
                { w: 'velocity!' }
              ]
            }
          ]
        },
        {
          id: 'clip-fb-2',
          title: 'The 84% Hold Rate Dual-Stimulus Architecture',
          start: 15.6,
          end: 30.4,
          score: 94,
          hookScore: 93,
          pacingScore: 94,
          retentionScore: 96,
          tag: '🧠 84% HOLD RATE',
          reason: 'Explains cognitive load balancing between spoken insight and procedural B-roll.',
          segments: [
            {
              start: 15.7,
              end: 25.9,
              words: [
                { w: 'When' },
                { w: 'you' },
                { w: 'pair' },
                { w: 'founder', e: '💡' },
                { w: 'storytelling' },
                { w: 'with' },
                { w: 'sixty' },
                { w: 'FPS' },
                { w: 'kinetic', e: '🔪' },
                { w: 'slicing' },
                { w: 'or' },
                { w: 'stunt' },
                { w: 'ramps,' },
                { w: 'three' },
                { w: 'second' },
                { w: 'hold' },
                { w: 'jumps', e: '📈' },
                { w: 'to' },
                { w: 'eighty-four' },
                { w: 'percent.' }
              ]
            },
            {
              start: 27.3,
              end: 30.3,
              words: [
                { w: 'That' },
                { w: 'triggers' },
                { w: 'exponential', e: '🚀' },
                { w: 'algorithmic' },
                { w: 'distribution.' }
              ]
            }
          ]
        },
        {
          id: 'clip-fb-3',
          title: 'Word-Level Karaoke Captions Boost Watch Time 41%',
          start: 30.6,
          end: 45.2,
          score: 91,
          hookScore: 89,
          pacingScore: 92,
          retentionScore: 93,
          tag: '🔤 CAPTION SCIENCE',
          reason: 'Actionable typography benchmark for silent-scroll mobile viewers.',
          segments: [
            {
              start: 30.7,
              end: 38.3,
              words: [
                { w: 'Seventy', e: '📱' },
                { w: 'percent' },
                { w: 'of' },
                { w: 'mobile' },
                { w: 'feeds' },
                { w: 'start' },
                { w: 'on' },
                { w: 'mute,' },
                { w: 'so' },
                { w: 'your' },
                { w: 'captions', e: '💬' },
                { w: 'are' },
                { w: 'your' },
                { w: 'actual' },
                { w: 'headline.' }
              ]
            },
            {
              start: 39.7,
              end: 45.1,
              words: [
                { w: 'Highlight' },
                { w: 'each' },
                { w: 'spoken' },
                { w: 'word', e: '✨' },
                { w: 'in' },
                { w: 'real' },
                { w: 'time' },
                { w: 'and' },
                { w: 'completion' },
                { w: 'rate' },
                { w: 'climbs', e: '🔥' },
                { w: 'forty-one' },
                { w: 'percent.' }
              ]
            }
          ]
        },
        {
          id: 'clip-fb-4',
          title: 'How Whop Automates Creator Clipping At Scale',
          start: 45.4,
          end: 59.8,
          score: 88,
          hookScore: 87,
          pacingScore: 90,
          retentionScore: 88,
          tag: '⚙️ SCALE SYSTEM',
          reason: 'Clear product thesis tying editing speed to Whop bounty monetization.',
          segments: [
            {
              start: 45.5,
              end: 49.1,
              words: [
                { w: 'Speed' },
                { w: 'is' },
                { w: 'the' },
                { w: 'ultimate', e: '⚡' },
                { w: 'moat' },
                { w: 'for' },
                { w: 'modern' },
                { w: 'clippers.' }
              ]
            },
            {
              start: 50.5,
              end: 59.6,
              words: [
                { w: 'Load' },
                { w: 'the' },
                { w: 'stream,' },
                { w: 'auto-slice', e: '✂️' },
                { w: 'the' },
                { w: 'top' },
                { w: 'viral' },
                { w: 'peak,' },
                { w: 'lock' },
                { w: 'in' },
                { w: 'your' },
                { w: 'B-roll,', e: '🎮' },
                { w: 'and' },
                { w: 'export' },
                { w: 'ready' },
                { w: 'for' },
                { w: 'Whop!', e: '🏆' }
              ]
            }
          ]
        }
      ]
    },
    'mrbeast-interview': {
      duration: 600,
      title: 'The Full Story of MrBeast',
      originalUrl: 'https://youtu.be/c8VcUnz3nVc',
      template: 'hormozi1',
      language: 'English',
      silences: [
        { start: 29.2, end: 30.0, duration: 0.8, label: 'Cut Silence (-0.8s)' },
        { start: 57.1, end: 58.0, duration: 0.9, label: 'Intro Pause (-0.9s)' },
        { start: 96.8, end: 98.0, duration: 1.2, label: 'Studio Beat (-1.2s)' },
        { start: 130.9, end: 132.0, duration: 1.1, label: 'Transition (-1.1s)' },
        { start: 167.0, end: 168.0, duration: 1.0, label: 'Breath Gap (-1.0s)' },
        { start: 206.8, end: 208.0, duration: 1.2, label: 'Pause (-1.2s)' },
        { start: 246.9, end: 248.0, duration: 1.1, label: 'Scene Cut (-1.1s)' },
        { start: 282.8, end: 284.0, duration: 1.2, label: 'Beat (-1.2s)' },
        { start: 316.9, end: 318.0, duration: 1.1, label: 'Mic Cut (-1.1s)' },
        { start: 352.8, end: 354.0, duration: 1.2, label: 'Transition (-1.2s)' },
        { start: 388.9, end: 390.0, duration: 1.1, label: 'Silence (-1.1s)' },
        { start: 424.8, end: 426.0, duration: 1.2, label: 'Cut (-1.2s)' },
        { start: 466.8, end: 468.0, duration: 1.2, label: 'Break (-1.2s)' }
      ],
      clips: [
        {
          id: 'clip-mb-1',
          title: '72 Hours with MrBeast',
          start: 0.0,
          end: 29.2,
          score: 100,
          hookScore: 100,
          pacingScore: 98,
          retentionScore: 100,
          tag: '🔥 #1 VIRAL HOOK',
          reason: 'This segment focuses on the valuable learning experience gained from spending time with MrBeast, emphasizing its educational aspect and potential insights into the creator\'s mindset and strategies.',
          transcriptText: 'After we put out our breakdown video about our time with Mr. Beast, a lot of people in the comments were asking for the full interview. This is the longest episode on our channel. But for us, experiencing 72 hours with Jimmy was so educational. And we pulled so much value from just being with him. I feel like spending the time to watch this full interview can really teach you a lot about Mr. Beast and just a lot about the career of being a creator. This episode of the Colin and Samir show is brought to you by Jelly Smack. If you want to check them out, the link is in the description, but more on them later in this episode. Colin, roll the intro.'
        },
        {
          id: 'clip-mb-2',
          title: "MrBeast's $20 Million Ask",
          start: 30.0,
          end: 57.1,
          score: 100,
          hookScore: 100,
          pacingScore: 99,
          retentionScore: 99,
          tag: '💰 $20M VIRAL HOOK',
          reason: 'This segment highlights MrBeast\'s ambitious financial goals and his direct appeal to Netflix, making it inherently attention-grabbing and sparking curiosity about the context of this request.',
          transcriptText: "All we need is $20 million. Hey, Netflix. How much would you pay me? It we're in too deep. Every other day we'd have mental breakdowns. You're funny. You want a job? Just put this out there. I did not enjoy being married alive. Why is Jimmy cry when he brought up money? So I make videos. What's up, everyone? Welcome to the Colin and Samir Show. I'm Samir. I'm Colin. And every week on this channel, we talk about the latest in the world of creators."
        },
        {
          id: 'clip-mb-3',
          title: 'New Studio, Who Dis?',
          start: 58.0,
          end: 96.8,
          score: 100,
          hookScore: 100,
          pacingScore: 97,
          retentionScore: 98,
          tag: '🏢 $10M STUDIO',
          reason: 'This segment details the speaker\'s journey from humble beginnings to acquiring a multi-million dollar studio, highlighting the strategic reasons behind the investment and addressing potential perceptions of extravagance. It also provides a sense of place by mentioning the speaker\'s hometown.',
          transcriptText: "So I got a mic on so I can move around a little bit. I just bought this brand new studio and 100 acres of land around it. This is where we're filming all our videos going. Not all, but all our indoor shoots going forward. I mean, ask me more questions. There's so much to talk about. It's impossible for us. How much did this cost? And how long in the making has this been? So. So the land around it, obviously the studio, the renovations and everything. And obviously we don't pay it all up front, but in total, it'll cost over $10 million. But it's probably not a good way to start because, like, there's so much explanation. People don't. It seems excessive. Why would you just buy this? You know what I mean? Like, the reason we bought this is because of, you know, it's as I've spent the entire day explaining to you, we had office and a bigger office, then a studio, a studio, then bigger studio, then a third studio, and then like. And now it's consolidating and it's like if I just. It's a weird way to start it because now it just sounds like I'm being expensive and Lavish for no reason. When there's a strategic reason why. You know what I mean?"
        },
        {
          id: 'clip-mb-4',
          title: 'Hometown Hero Studio',
          start: 98.0,
          end: 130.9,
          score: 90,
          hookScore: 91,
          pacingScore: 90,
          retentionScore: 90,
          tag: '🌟 RELATABLE ORIGIN',
          reason: 'This segment emphasizes the speaker\'s connection to his hometown and the interesting experiences of connecting with people from his past, providing a personal and relatable touch to the studio reveal.',
          transcriptText: "I mean, you, obviously, you started in your bedroom, Right. At the cost of zero. Exactly. But still, I'd rather, I'd love to work our way up, not just go, hey, look at this. Because now I just seem like some dumb, rich YouTuber. You know what I mean? Yeah. So not only are we here in your, you know, brand new studio, but we're here in your hometown. And I think that's been one of the most interesting things to experience is spending a day with you here, even spending time with your mom, even some of the places. That's a fun sentence, but even spending time here in your hometown. Like, we've met people who grew up with you. Yeah. Which is really interesting."
        },
        {
          id: 'clip-mb-5',
          title: "MrBeast's Reinvestment Secret",
          start: 132.0,
          end: 167.0,
          score: 82,
          hookScore: 84,
          pacingScore: 82,
          retentionScore: 83,
          tag: '📈 100% REINVESTMENT',
          reason: 'This segment focuses on MrBeast\'s dedication to reinvesting all his earnings back into his content, a strategy that has fueled his exponential growth. This is a strong message for aspiring creators.',
          transcriptText: "I just kept going and reinvesting. And then I tip pizza delivery people 100 bucks, and then I tipped a homeless man 10 grand. And then, you know, gave away cars, gave away houses. And last hand, take, take hand off. Million dollars. Keeps it. And basically the entire time. So, like, for the last, like, eight or nine years, like, every dollar I've made, I just spent it the next month on content. And I just did that every single month. And it just kept getting bigger and bigger. And here we are."
        },
        {
          id: 'clip-mb-6',
          title: 'Doubling Down for Views',
          start: 168.0,
          end: 206.8,
          score: 82,
          hookScore: 83,
          pacingScore: 81,
          retentionScore: 82,
          tag: '💡 VIRAL NEGOTIATION',
          reason: 'This segment describes a pivotal moment where MrBeast negotiated a brand deal and doubled the amount to give it away, demonstrating his early understanding of viral content and commitment to his brand.',
          transcriptText: "Well, so I did my first brand deal. I'm sure you guys have heard the story, but for people that know, I. I was offered five grand for a video, but this was when I was, like, 19 and so much money. It's like, mom, look, look. And I was like, double it, and I'll walk outside and I'll give it to homeless person. And they're like, no, you won't. I was like, double it. And I like, pacing around my neighborhood for three hours convincing this guy, like, on the phone, just double the money. I promise the video will go viral, and I'll give it to homeless persons. I was like, $10,000 just looks better in a title. It'll get more views. I promise your app will do better. And I ended up getting $10,000 and then gave it away. And my mom's like, why don't you just give away $8,000? 9,000. Why all 10,000? I was like, mom, it'll look better at the title, and it's just better, you know? And that's basically that."
        },
        {
          id: 'clip-mb-7',
          title: 'YouTube Obsession Before Fame',
          start: 208.0,
          end: 246.9,
          score: 80,
          hookScore: 80,
          pacingScore: 80,
          retentionScore: 80,
          tag: '🎯 OBSESSION TO MASTERY',
          reason: 'This segment details the speaker\'s early obsession with YouTube and feeling like an outsider, a relatable experience for many aspiring creators. The eventual validation and finding a community is also compelling.',
          transcriptText: "Were there other people when you were growing up making YouTube videos around me? No, no, that was the biggest problem is I thought it was a freak of nature because like, people would tell me, all you do is talk about YouTube. You're too obsessed with YouTube. Like, get a life. Like from 13 to like 19. I never met anyone who cared about YouTube, like, not even else. And so I was so un talkative, people thought like there was problems with me because I just wouldn't talk to anyone. Cause all I would do is talk about YouTube. And after a while, like, you realize, like, no one cares. Like you just get labeled as the guy that just only likes YouTube. And so I kind of just like didn't talk at all. And then when I was 19 and I had like 10,000 subscribers, maybe it was like 18. And that's when I started meeting a few other YouTubers online. And I realized, like, I'm not a freak. I'm just like obsessed with YouTube. And that's okay, you know, you just gotta find other people that are like that."
        },
        {
          id: 'clip-mb-8',
          title: 'Custom Sets = Viral Videos',
          start: 248.0,
          end: 282.8,
          score: 78,
          hookScore: 78,
          pacingScore: 78,
          retentionScore: 78,
          tag: '🎬 CUSTOM SETS',
          reason: 'Highlights the surprising level of custom set design involved in creating viral videos.',
          transcriptText: "And I think what I realized was being somewhere like this, the positives actually outweigh the negatives so much in that there's so much focus. Agreed. And you are like, you're really moving from thing to thing to thing. I think we watched you workshop about four videos in such a short amount of time. Yeah. And that I thought was one of the most interesting things. And just sitting there in those meetings, understanding how you're thinking about what needs to happen and then additionally having the facilities and the team members who are ready to custom make things for the stories. Like, I don't know if people realize. I didn't realize. And I've been watching your videos. I've talked to you, we've interviewed you. And I didn't realize that every set is like custom built for the video based on. They have to come from somewhere. Yeah. But I mean, you would think that. Okay, let's reuse that or let's, you know, we could. Let's see how many videos we can film in this set. Gotcha. But you know what I mean, like, it's just like it's part of the story."
        },
        {
          id: 'clip-mb-9',
          title: "MrBeast's First Big Giveaway",
          start: 284.0,
          end: 316.9,
          score: 78,
          hookScore: 79,
          pacingScore: 77,
          retentionScore: 78,
          tag: '💸 $10K GIVEAWAY',
          reason: 'This segment highlights MrBeast\'s early days of giving away money, starting from small donations to larger sums, showcasing his evolution and initial motivations.',
          transcriptText: "You give away millions of dollars now, $500,000 at a time. Like, large sums of money. But when you first started giving away 5,000 or 10,000, it's first started with $100. Literally, like, even less than that. Like, donating, like, 10 bucks to Twitch streamers and stuff like that. But, like, the first real IRL one, I would order a pizza and I'd tip 100 bucks. I think I did, like, three in that video. So it was like $300. But when it gets to 10,000, that's when I think people. And I would imagine people around you, like, your mom are probably like, jimmy. What? Are you sure about that? Exactly. Like, what was her reaction to that?"
        },
        {
          id: 'clip-mb-10',
          title: "MrBeast's Investment Strategy",
          start: 318.0,
          end: 352.8,
          score: 78,
          hookScore: 77,
          pacingScore: 79,
          retentionScore: 78,
          tag: '📊 EQUIPMENT UPGRADES',
          reason: 'This segment highlights MrBeast\'s consistent reinvestment strategy, which is key to his success and resonates with viewers interested in entrepreneurship and content creation.',
          transcriptText: "Literally put on me the entire time when I used to make like a dollar a day. I saved up for months and I bought a microphone. Way worse than this microphone. And then I saved up for like half a year and I bought a computer and I. The whole time I was like recording on my iPhone. So I was recording and editing on my iPhone when I first started. And then I got a microphone you could plug in. I got a computer to edit on. And then after like two years of just filming on my phone, I had 100 plus thousand subscribers. But I still didn't have a camera because those things cost like 1,000 bucks. Or I was stupid. I didn't realize you could buy like a G7 extra $400. So then I bought a camera, and after that, I bought monitors for my computer. I just kept going and reinvesting. And then I tip pizza delivery people 100 bucks, and then I tipped a homeless man 10 grand."
        },
        {
          id: 'clip-mb-11',
          title: 'Giving Away Money is Fun',
          start: 354.0,
          end: 388.9,
          score: 75,
          hookScore: 76,
          pacingScore: 74,
          retentionScore: 75,
          tag: '❤️ GENUINE JOY',
          reason: 'This segment highlights the joy of giving and seeing people\'s reactions, which can be very engaging and emotionally resonant for viewers.',
          transcriptText: "And then it's something I've Always enjoyed, like, even when I was, I want to say poor. I don't over dramaticize my story. Like, you know, we weren't ever the poor, but I didn't have as much money. If I saw a homeless person, I would, you know, over my wallet and give them almost all the money I had. It's just fun, you know, because then you see the reaction, their face light up, stuff like that. And so it kind of was just something I always enjoyed because there are so much easier ways to get views back then than like having to give away money and less stressful stuff. But I just enjoyed it and I thought it was interesting to see people's reactions and like to try to. Like they're expecting a dollar and you give them 100 and they're like, oh my God, you know? Yeah. So it's kind of like a mixture of what I thought was interesting, but also what I enjoy, if that makes sense."
        },
        {
          id: 'clip-mb-12',
          title: 'From iPhone to Millions!',
          start: 390.0,
          end: 424.8,
          score: 75,
          hookScore: 75,
          pacingScore: 75,
          retentionScore: 75,
          tag: '📱 HUMBLE ROOTS',
          reason: 'This segment showcases MrBeast\'s humble beginnings and gradual upgrade in equipment, inspiring viewers with the message that success can be achieved even with limited resources.',
          transcriptText: "And then I saved up for like half a year and I bought a computer and I. The whole time I was like recording on my iPhone. So I was recording and editing on my iPhone when I first started. And then I got a microphone you could plug in. I got a computer to edit on. And then after like two years of just filming on my phone, I had 100 plus thousand subscribers. But I still didn't have a camera because those things cost like 1,000 bucks. Or I was stupid. I didn't realize you could buy like a G7 extra $400. So then I bought a camera, and after that, I bought monitors for my computer. I just kept going and reinvesting. And then I tip pizza delivery people 100 bucks, and then I tipped a homeless man 10 grand. And then, you know, gave away cars, gave away houses."
        },
        {
          id: 'clip-mb-13',
          title: 'Small Town Success',
          start: 426.0,
          end: 466.8,
          score: 75,
          hookScore: 74,
          pacingScore: 76,
          retentionScore: 75,
          tag: '🏘️ SMALL TOWN WIN',
          reason: 'This segment highlights the unexpected advantages of staying in a small town for business, challenging the common belief that success requires moving to a big city. It\'s relatable to many people who feel tied to their hometowns but aspire to achieve great things.',
          transcriptText: "And it's really interesting to meet people and recognize, like, you are still in your hometown. And a lot of people who are from small towns in the us they think like, I gotta get out of this town to find success. So why did you stay in this town and how do you think you found success staying here? Honestly, it really was easier to just stay here, you know, as I started making the videos bigger and bigger and hiring people and I got warehouses and studios. Like, you get so anchored down, like, well, you're just going to relocate all your employees to LA and buy a studio space there that costs ten times more. Why? You know, like, what, what are the negatives of being in a small town? I would argue with the Internet and things like Zoom, where you can talk to everyone and, and we're so interconnected. Like, there really is no need to pay 12% more tax because of, what is it? State tax in California, and then on top of that, pay like three to five times more for rent and. And all this other stuff."
        },
        {
          id: 'clip-mb-14',
          title: 'High School YouTube Doubters',
          start: 468.0,
          end: 512.0,
          score: 70,
          hookScore: 71,
          pacingScore: 70,
          retentionScore: 70,
          tag: '🗣️ LUNCH TABLE DOUBTERS',
          reason: 'This segment illustrates the speaker\'s struggle to fit in due to his passion for YouTube and the lack of understanding from his peers, culminating in a humorous comparison of then vs. now.',
          transcriptText: "Most people wanna talk about south park when you're younger or when I was younger, cartoons or whatever. And I back then was figuring out how to drop ship or how to better edit a video or stuff like that. Bring that up at a high school lunch table. Well, I guess now people care. Bring that up at a high school lunch table 10 years ago and see what they say. They're like, what the you talking about? What's interesting is I went back and I, you know, I did this a while ago, but I did it recently again where I go to oldest uploaded videos on your channel. You have some videos that are actually kind of similar to the videos we make. Where you were talking about other creators and how they were grow back when I did Call of Duty commentaries. Yeah, yeah. So you would play Call of Duty and then you would talk about. Yeah, other creators. I thought that was really interesting to watch."
        }
      ]
    }
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function hashNoise(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  /**
   * Expands segment definitions or raw transcriptText into frame-accurate word-level timestamps:
   * `{ word, start, end, relStart, relEnd, emoji, emphasis }`
   */
  function buildClipTranscript(clip) {
    if (Array.isArray(clip.segments) && clip.segments.length > 0) {
      const words = [];
      clip.segments.forEach((seg) => {
        const count = seg.words.length;
        const segDur = Math.max(0.2, seg.end - seg.start);
        const weights = seg.words.map((item) => Math.max(3, item.w.length));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let cursor = seg.start;
        for (let i = 0; i < count; i++) {
          const item = seg.words[i];
          const wDur = (weights[i] / totalWeight) * segDur;
          const wStart = Number(cursor.toFixed(3));
          const wEnd = Number((i === count - 1 ? seg.end : cursor + wDur).toFixed(3));
          cursor += wDur;

          words.push({
            word: item.w,
            start: wStart,
            end: wEnd,
            relStart: Number((wStart - clip.start).toFixed(3)),
            relEnd: Number((wEnd - clip.start).toFixed(3)),
            emoji: item.e || '',
            emphasis: Boolean(item.e || /[A-Z]{3,}|\$|%|!/.test(item.w))
          });
        }
      });
      return words;
    }

    if (clip.transcriptText) {
      const rawWords = clip.transcriptText.trim().split(/\s+/);
      const totalWords = rawWords.length;
      const clipDur = Math.max(0.5, clip.end - clip.start);
      const weights = rawWords.map((w) => Math.max(3, w.length));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      const emojiMap = {
        beast: '🦁', jimmy: '👑', million: '💰', dollars: '💵', dollar: '💵',
        money: '💸', studio: '🏢', netflix: '🎬', video: '🎥', videos: '🎥',
        youtube: '▶️', creator: '🚀', interview: '🎙️', rich: '💎', reinvesting: '📈',
        homeless: '🤝', pizza: '🍕', cars: '🚗', houses: '🏠', iphone: '📱',
        camera: '📷', computer: '💻', subscribers: '🔔', viral: '🔥', views: '👀',
        giveaway: '🎁', fun: '🎉', freak: '⚡', obsessed: '🧠', success: '🏆'
      };

      let cursor = clip.start;
      const words = [];
      for (let i = 0; i < totalWords; i++) {
        const wStr = rawWords[i];
        const cleanLower = wStr.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedEmoji = emojiMap[cleanLower] || '';
        const wDur = (weights[i] / totalWeight) * clipDur;
        const wStart = Number(cursor.toFixed(3));
        const wEnd = Number((i === totalWords - 1 ? clip.end : cursor + wDur).toFixed(3));
        cursor += wDur;

        words.push({
          word: wStr,
          start: wStart,
          end: wEnd,
          relStart: Number((wStart - clip.start).toFixed(3)),
          relEnd: Number((wEnd - clip.start).toFixed(3)),
          emoji: matchedEmoji,
          emphasis: Boolean(matchedEmoji || /[A-Z]{2,}|\$|%|!/.test(wStr) || cleanLower === 'beast' || cleanLower === 'million')
        });
      }
      return words;
    }

    return [];
  }

  /**
   * Generates a 160-bar normalized waveform array (`0.05..1.0`) aligned with
   * the silence map and viral hook peaks.
   */
  function buildDeterministicPeaks(presetId, duration, silences, clips, barCount = 160) {
    const seed =
      presetId === 'streamer-alpha' ? 19.3 : presetId === 'founder-breakdown' ? 41.7 : 7.1;
    const peaks = new Array(barCount);

    for (let i = 0; i < barCount; i++) {
      const t = (i / barCount) * duration;

      // Check if timestamp falls inside a silence interval
      let inSilence = false;
      for (let s = 0; s < silences.length; s++) {
        if (t >= silences[s].start && t <= silences[s].end) {
          inSilence = true;
          break;
        }
      }

      if (inSilence) {
        peaks[i] = Number((0.05 + hashNoise(i + seed) * 0.03).toFixed(3));
        continue;
      }

      // Check if timestamp is inside a high-scoring viral hook window
      let hookBoost = 0;
      for (let c = 0; c < clips.length; c++) {
        const clip = clips[c];
        if (t >= clip.start && t <= clip.end) {
          const clipProgress = (t - clip.start) / Math.max(1, clip.end - clip.start);
          // Extra energy at the opening hook and closing punchline of each clip
          if (clipProgress < 0.28 || clipProgress > 0.78) {
            hookBoost = 0.24 * (clip.score / 100);
          } else {
            hookBoost = 0.12 * (clip.score / 100);
          }
          break;
        }
      }

      const n1 = hashNoise(i * 1.3 + seed);
      const n2 = Math.abs(Math.sin(i * 0.45 + seed));
      const raw = 0.24 + n1 * 0.38 + n2 * 0.22 + hookBoost;
      peaks[i] = Number(clamp(raw, 0.08, 1.0).toFixed(3));
    }

    return peaks;
  }

  /**
   * Builds the complete analysis payload for a preset or custom video duration.
   */
  function buildAnalysisPayload(presetKey, customDuration, customPeaks, customSilences) {
    const key = DEMO_SCRIPTS[presetKey] ? presetKey : 'podcast-millionaire';
    const template = DEMO_SCRIPTS[key];
    const duration =
      typeof customDuration === 'number' && customDuration > 2
        ? customDuration
        : template.duration;
    const timeScale = duration / template.duration;

    const silences =
      Array.isArray(customSilences) && customSilences.length > 0
        ? customSilences
        : template.silences.map((s) => {
            const start = Number((s.start * timeScale).toFixed(2));
            const end = Number((s.end * timeScale).toFixed(2));
            return {
              start,
              end,
              duration: Number((end - start).toFixed(2)),
              label: s.label
            };
          });

    const allTranscriptWords = [];
    const viralMoments = template.clips.map((clip) => {
      const scaledClip = {
        ...clip,
        start: Number((clip.start * timeScale).toFixed(2)),
        end: Number((clip.end * timeScale).toFixed(2)),
        segments: Array.isArray(clip.segments)
          ? clip.segments.map((seg) => ({
              start: seg.start * timeScale,
              end: seg.end * timeScale,
              words: seg.words
            }))
          : null,
        transcriptText: clip.transcriptText || ''
      };
      const transcript = buildClipTranscript(scaledClip);
      allTranscriptWords.push(...transcript);

      return {
        id: scaledClip.id,
        title: scaledClip.title,
        start: scaledClip.start,
        end: scaledClip.end,
        duration: Number((scaledClip.end - scaledClip.start).toFixed(2)),
        score: scaledClip.score,
        hookScore: scaledClip.hookScore,
        pacingScore: scaledClip.pacingScore,
        retentionScore: scaledClip.retentionScore,
        tag: scaledClip.tag,
        reason: scaledClip.reason,
        transcript
      };
    });

    const peaks =
      Array.isArray(customPeaks) && customPeaks.length === 160
        ? customPeaks
        : buildDeterministicPeaks(key, duration, silences, viralMoments, 160);

    const totalSavedSec = Number(
      silences.reduce((acc, s) => acc + Math.max(0, s.end - s.start), 0).toFixed(1)
    );

    return {
      presetId: key,
      duration,
      peaks,
      silences,
      totalSilenceSavedSec: totalSavedSec,
      viralMoments,
      transcript: allTranscriptWords
    };
  }

  /**
   * Wraps an analysis result object with a non-enumerable `.then` so that:
   *  - Synchronous callers (`const res = analyze(...); res.peaks`) work immediately!
   *  - Async callers (`const res = await analyze(...)` or `analyze(...).then(...)`) also work!
   */
  function makeDualSyncAsyncResult(payload) {
    const result = Object.assign({}, payload);
    Object.defineProperty(result, 'then', {
      enumerable: false,
      configurable: true,
      value: function (onFulfilled, onRejected) {
        return Promise.resolve(Object.assign({}, payload)).then(onFulfilled, onRejected);
      }
    });
    return result;
  }

  // ============================================================================
  // MAIN CLASS: WhopAudioEngine
  // ============================================================================

  class WhopAudioEngine {
    constructor() {
      this.audioCtx = null;
      this.masterGain = null;
      this.mainGain = null;
      this.brollGain = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.demoVoiceGain = null;
      this.analyser = null;
      this.exportDestination = null;
      this.noiseBuffer = null;

      // Track MediaElementSourceNodes so re-connecting the same <video> never throws
      this._mediaElementSources = new WeakMap();

      this.musicPreset = 'none';
      this.isPlaying = false;
      this.demoModeActive = true;
      this.volumes = {
        master: 0.9,
        main: 0.95,
        broll: 0.15,
        music: 0.0,
        sfx: 0.65
      };

      this._schedulerTimer = null;
      this._stepIndex = 0;
      this._freqData = null;
      this._timeData = null;
    }

    /**
     * Initializes (or resumes) the WebAudio API graph and MediaStreamAudioDestinationNode.
     */
    init() {
      if (!this.audioCtx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;

        this.audioCtx = new AudioCtx();
        this.masterGain = this.audioCtx.createGain();
        this.mainGain = this.audioCtx.createGain();
        this.brollGain = this.audioCtx.createGain();
        this.musicGain = this.audioCtx.createGain();
        this.sfxGain = this.audioCtx.createGain();
        this.demoVoiceGain = this.audioCtx.createGain();

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.78;
        this._freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this._timeData = new Uint8Array(this.analyser.fftSize);

        // Create MediaStream destination for MediaRecorder export with audio
        if (typeof this.audioCtx.createMediaStreamDestination === 'function') {
          this.exportDestination = this.audioCtx.createMediaStreamDestination();
        }

        // Apply initial gain levels
        this.masterGain.gain.value = this.volumes.master;
        this.mainGain.gain.value = this.volumes.main;
        this.brollGain.gain.value = this.volumes.broll;
        this.musicGain.gain.value = this.volumes.music;
        this.sfxGain.gain.value = this.volumes.sfx;
        this.demoVoiceGain.gain.value = 0.22;

        // Wire sub-buses into masterGain
        this.mainGain.connect(this.masterGain);
        this.brollGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.demoVoiceGain.connect(this.masterGain);

        // Wire masterGain -> Analyser -> Speakers AND Export MediaStream
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
        if (this.exportDestination) {
          this.masterGain.connect(this.exportDestination);
        }

        this._createNoiseBuffer();
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    resume() {
      return this.init();
    }

    _createNoiseBuffer() {
      if (!this.audioCtx) return;
      const sampleRate = this.audioCtx.sampleRate;
      const length = sampleRate * 2;
      const buffer = this.audioCtx.createBuffer(1, length, sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    /**
     * Connects an HTML5 <video> element for the Main Feed into the WebAudio mixer.
     */
    connectMainVideo(videoEl) {
      if (!videoEl || typeof videoEl.nodeName !== 'string') return null;
      this.init();
      if (!this.audioCtx) return null;

      try {
        let sourceNode = this._mediaElementSources.get(videoEl);
        if (!sourceNode) {
          sourceNode = this.audioCtx.createMediaElementSource(videoEl);
          this._mediaElementSources.set(videoEl, sourceNode);
        }
        sourceNode.disconnect();
        sourceNode.connect(this.mainGain);
        return sourceNode;
      } catch (err) {
        return null;
      }
    }

    /**
     * Connects an HTML5 <video> element for the B-Roll Feed into the WebAudio mixer.
     */
    connectBrollVideo(videoEl) {
      if (!videoEl || typeof videoEl.nodeName !== 'string') return null;
      this.init();
      if (!this.audioCtx) return null;

      try {
        let sourceNode = this._mediaElementSources.get(videoEl);
        if (!sourceNode) {
          sourceNode = this.audioCtx.createMediaElementSource(videoEl);
          this._mediaElementSources.set(videoEl, sourceNode);
        }
        sourceNode.disconnect();
        sourceNode.connect(this.brollGain);
        return sourceNode;
      } catch (err) {
        return null;
      }
    }

    /**
     * Convenience method to connect both main and B-roll <video> elements at once.
     */
    connectVideos(mainVideoEl, brollVideoEl) {
      if (mainVideoEl) this.connectMainVideo(mainVideoEl);
      if (brollVideoEl) this.connectBrollVideo(brollVideoEl);
    }

    /**
     * Returns the live MediaStream from `MediaStreamAudioDestinationNode` for MediaRecorder export.
     */
    getExportAudioStream() {
      this.init();
      return this.exportDestination ? this.exportDestination.stream : null;
    }

    getAudioStream() {
      return this.getExportAudioStream();
    }

    getDestinationStream() {
      return this.getExportAudioStream();
    }

    /**
     * Adjusts mixer bus volumes (0.0 .. 1.0)
     */
    setVolumes(vols = {}) {
      Object.assign(this.volumes, vols);
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      if (typeof vols.master === 'number') {
        this.masterGain.gain.setTargetAtTime(clamp(vols.master, 0, 1.5), now, 0.02);
      }
      if (typeof vols.main === 'number') {
        this.mainGain.gain.setTargetAtTime(clamp(vols.main, 0, 1.5), now, 0.02);
      }
      if (typeof vols.broll === 'number') {
        this.brollGain.gain.setTargetAtTime(clamp(vols.broll, 0, 1.5), now, 0.02);
      }
      if (typeof vols.music === 'number') {
        this.musicGain.gain.setTargetAtTime(clamp(vols.music, 0, 1.5), now, 0.02);
      }
      if (typeof vols.sfx === 'number') {
        this.sfxGain.gain.setTargetAtTime(clamp(vols.sfx, 0, 1.5), now, 0.02);
      }
    }

    setMainVolume(v) {
      this.setVolumes({ main: v });
    }

    setBrollVolume(v) {
      this.setVolumes({ broll: v });
    }

    setMusicVolume(v) {
      this.setVolumes({ music: v });
    }

    setMasterVolume(v) {
      this.setVolumes({ master: v });
    }

    /**
     * Selects the active procedural background music bed:
     * 'phonk-drive' | 'lofi-chill' | 'tension-riser' | 'none'
     */
    setMusicPreset(presetId) {
      this.musicPreset = presetId || 'none';
      if (this.musicPreset === 'none') {
        this.stopMusic();
        if (this.musicGain && this.audioCtx) {
          this.musicGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        }
      } else if (this.musicGain && this.audioCtx) {
        this.musicGain.gain.setTargetAtTime(this.volumes.music || 0.25, this.audioCtx.currentTime, 0.03);
      }
    }

    setMusicBed(presetId) {
      this.setMusicPreset(presetId);
    }

    /**
     * Starts procedural background music synthesis synced to playback.
     */
    startMusic(presetId, startTimeSec = 0) {
      if (presetId) this.setMusicPreset(presetId);
      if (!this.musicPreset || this.musicPreset === 'none') {
        this.stopMusic();
        return;
      }
      this.init();
      this.isPlaying = true;

      if (this._schedulerTimer) {
        clearInterval(this._schedulerTimer);
      }

      const stepMs = 115; // ~130 BPM 16th-note grid
      this._stepIndex = Math.floor((startTimeSec * 1000) / stepMs);

      this._schedulerTimer = setInterval(() => {
        if (!this.isPlaying || !this.audioCtx) return;
        this._triggerProceduralMusicStep(this._stepIndex);
        this._stepIndex++;
      }, stepMs);
    }

    /**
     * Stops the procedural background music bed cleanly.
     */
    stopMusic() {
      this.isPlaying = false;
      if (this._schedulerTimer) {
        clearInterval(this._schedulerTimer);
        this._schedulerTimer = null;
      }
    }

    /**
     * Synchronizes engine play/pause state with the timeline preview/export loop.
     */
    syncPlayback(timeSec, isPlaying, options = {}) {
      if (options.musicPreset && options.musicPreset !== this.musicPreset) {
        this.setMusicPreset(options.musicPreset);
      }
      if (typeof options.demoMode === 'boolean') {
        this.demoModeActive = options.demoMode;
      }
      if (isPlaying && !this.isPlaying) {
        this.startMusic(this.musicPreset, timeSec);
      } else if (!isPlaying && this.isPlaying) {
        this.stopMusic();
      }
    }

    /**
     * Internal WebAudio synthesizer for the 3 procedural music beds:
     *  - 'phonk-drive': Drift phonk 808 sub bass, distorted cowbell lead, crisp trap hi-hats
     *  - 'lofi-chill': Warm Rhodes electric piano jazz chords, soft kick/rim, vinyl warmth
     *  - 'tension-riser': Dark cinematic pulsing synth drone, heart-pulse kick, rising shimmer
     */
    _triggerProceduralMusicStep(step) {
      if (!this.audioCtx || this.musicPreset === 'none') return;
      const now = this.audioCtx.currentTime;
      const preset = String(this.musicPreset).toLowerCase();

      if (preset.includes('phonk')) {
        // 1. 808 Sub Kick on steps 0, 6, 8, 14
        if (step % 16 === 0 || step % 16 === 6 || step % 16 === 8 || step % 16 === 14) {
          this._synthKick808(now, 58, 0.22);
        }
        // 2. Iconic Drift Phonk Cowbell Melody (D minor Phrygian riff)
        const cowbellMelody = [
          587.33, 0, 587.33, 698.46, 659.25, 0, 587.33, 523.25,
          587.33, 0, 783.99, 698.46, 659.25, 587.33, 523.25, 0
        ];
        const freq = cowbellMelody[step % 16];
        if (freq > 0) {
          this._synthPhonkCowbell(now, freq, 0.11);
        }
        // 3. Trap Hi-Hat roll
        if (step % 2 === 0 || step % 16 === 15) {
          this._synthHiHat(now, step % 4 === 2 ? 0.06 : 0.03);
        }
      } else if (preset.includes('lofi')) {
        // Warm Lofi Rhodes chord progression on every 8 steps
        if (step % 8 === 0) {
          const chordProg = [
            [293.66, 349.23, 440.0, 523.25], // Dm7
            [246.94, 349.23, 392.0, 493.88], // G7
            [261.63, 329.63, 392.0, 493.88], // Cmaj7
            [220.0, 277.18, 329.63, 392.0]   // A7
          ];
          const chord = chordProg[Math.floor(step / 8) % chordProg.length];
          this._synthLofiChord(now, chord, 0.85);
        }
        // Boom-bap dusty kick & rimshot
        if (step % 16 === 0 || step % 16 === 10) {
          this._synthKick808(now, 52, 0.16);
        }
        if (step % 8 === 4) {
          this._synthHiHat(now, 0.05);
        }
      } else if (preset.includes('tension') || preset.includes('riser')) {
        // Dark pulsing cinematic synth bass on every 2 steps
        if (step % 2 === 0) {
          const baseFreq = step % 32 < 16 ? 73.42 : 65.41; // D2 -> C2
          const riserPitch = 1 + ((step % 32) / 32) * 0.18;
          this._synthTensionPulse(now, baseFreq * riserPitch, 0.18);
        }
        // Cinematic heartbeat thump
        if (step % 8 === 0 || step % 8 === 2) {
          this._synthKick808(now, 48, 0.15);
        }
      }
    }

    _synthKick808(now, tailFreq = 55, duration = 0.2) {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(tailFreq, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(32, now + duration);

      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    _synthPhonkCowbell(now, freq, duration = 0.11) {
      // Classic 808 cowbell uses two detuned square waves through a bandpass filter
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.48, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.2, now);
      filter.Q.setValueAtTime(3.2, now);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.01);
      osc2.stop(now + duration + 0.01);
    }

    _synthHiHat(now, duration = 0.04) {
      if (!this.noiseBuffer) return;
      const src = this.audioCtx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, now);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      src.start(now);
      src.stop(now + duration + 0.01);
    }

    _synthLofiChord(now, freqs, duration = 0.85) {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);

      const masterChordGain = this.audioCtx.createGain();
      masterChordGain.gain.setValueAtTime(0.01, now);
      masterChordGain.gain.linearRampToValueAtTime(0.09, now + 0.04);
      masterChordGain.gain.exponentialRampToValueAtTime(0.002, now + duration);

      filter.connect(masterChordGain);
      masterChordGain.connect(this.musicGain);

      freqs.forEach((f) => {
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      });
    }

    _synthTensionPulse(now, freq, duration = 0.18) {
      const osc = this.audioCtx.createOscillator();
      const filter = this.audioCtx.createBiquadFilter();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + duration + 0.01);
    }

    /**
     * Triggers a viral transition or UI sound effect ('whoosh', 'ding', 'bass-drop', 'cash', 'pop')
     */
    playSfx(type = 'whoosh') {
      this.init();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const sfxType = String(type).toLowerCase();

      if (sfxType.includes('ding') || sfxType.includes('cash')) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.07); // E6
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.46);
      } else if (sfxType.includes('bass') || sfxType.includes('drop')) {
        this._synthKick808(now, 38, 0.55);
      } else {
        // High-retention 'whoosh' / 'pop' transition
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    }

    triggerSfx(type) {
      this.playSfx(type);
    }

    /**
     * Reads real-time audio level (0.0 .. 1.0) from the master AnalyserNode
     */
    getCurrentLevel(fallbackTimeSec = 0) {
      if (this.analyser && this.audioCtx && this.audioCtx.state === 'running' && this.isPlaying) {
        this.analyser.getByteTimeDomainData(this._timeData);
        let sumSq = 0;
        for (let i = 0; i < this._timeData.length; i++) {
          const norm = (this._timeData[i] - 128) / 128;
          sumSq += norm * norm;
        }
        const rms = Math.sqrt(sumSq / this._timeData.length);
        if (rms > 0.01) {
          return clamp(rms * 2.8, 0.05, 1.0);
        }
      }
      // Fallback to deterministic speech envelope
      return clamp(
        0.15 + Math.abs(Math.sin(fallbackTimeSec * 13.5)) * 0.65,
        0.05,
        1.0
      );
    }

    /**
     * Generates a realistic deterministic or file-based Audio Waveform & Viral Peak / Silence Map.
     * Supports both synchronous access (`const res = analyzeVideoBufferOrDemo('podcast-millionaire')`)
     * AND Promise/async `await analyzeVideoBufferOrDemo(fileOrPreset)`.
     *
     * @param {string|File|Blob|HTMLVideoElement} videoFileOrPreset
     * @param {object} [options]
     * @returns {{
     *   peaks: number[],
     *   silences: Array<{start:number, end:number, duration:number, label:string}>,
     *   viralMoments: Array<{
     *     id:string, title:string, start:number, end:number, duration:number,
     *     score:number, hookScore:number, pacingScore:number, retentionScore:number,
     *     tag:string, reason:string,
     *     transcript: Array<{word:string, start:number, end:number, relStart:number, relEnd:number, emoji:string, emphasis:boolean}>
     *   }>,
     *   transcript: Array<{word:string, start:number, end:number, emoji:string}>
     * }}
     */
    analyzeVideoBufferOrDemo(videoFileOrPreset = 'podcast-millionaire', options = {}) {
      // Case 1: String preset ID (or empty/null) -> immediate deterministic analysis
      if (!videoFileOrPreset || typeof videoFileOrPreset === 'string') {
        const rawId = String(videoFileOrPreset || 'podcast-millionaire').toLowerCase();
        let presetKey = 'podcast-millionaire';
        if (rawId.includes('streamer')) presetKey = 'streamer-alpha';
        else if (rawId.includes('founder') || rawId.includes('saas')) presetKey = 'founder-breakdown';
        else if (rawId.includes('beast') || rawId.includes('mrbeast') || rawId.includes('c8vcunz3nvc')) presetKey = 'mrbeast-interview';

        const payload = buildAnalysisPayload(presetKey, options.duration);
        return makeDualSyncAsyncResult(payload);
      }

      // Case 2: Uploaded File / Blob -> decode real WebAudio waveform if possible, with instant fallback
      const fallbackPayload = buildAnalysisPayload(
        options.presetId || 'podcast-millionaire',
        options.duration || 60
      );

      if (
        typeof Blob !== 'undefined' &&
        videoFileOrPreset instanceof Blob &&
        typeof videoFileOrPreset.arrayBuffer === 'function'
      ) {
        const asyncPromise = videoFileOrPreset
          .arrayBuffer()
          .then((buffer) => {
            this.init();
            if (!this.audioCtx) return fallbackPayload;
            return this.audioCtx.decodeAudioData(buffer);
          })
          .then((audioBuffer) => {
            if (!audioBuffer || !audioBuffer.duration) return fallbackPayload;
            const channelData = audioBuffer.getChannelData(0);
            const barCount = 160;
            const samplesPerBar = Math.max(1, Math.floor(channelData.length / barCount));
            const rawPeaks = new Array(barCount);
            let maxPeak = 0.01;

            for (let i = 0; i < barCount; i++) {
              const startIdx = i * samplesPerBar;
              let sum = 0;
              const stride = Math.max(1, Math.floor(samplesPerBar / 64));
              let count = 0;
              for (let j = 0; j < samplesPerBar && startIdx + j < channelData.length; j += stride) {
                const sample = channelData[startIdx + j];
                sum += sample * sample;
                count++;
              }
              const rms = Math.sqrt(sum / Math.max(1, count));
              rawPeaks[i] = rms;
              if (rms > maxPeak) maxPeak = rms;
            }

            const normalizedPeaks = rawPeaks.map((p) =>
              Number(clamp(p / maxPeak, 0.05, 1.0).toFixed(3))
            );

            // Detect real silence intervals (< 0.11 normalized amplitude for >= 2 consecutive bars)
            const detectedSilences = [];
            const barDur = audioBuffer.duration / barCount;
            let silStart = null;
            for (let i = 0; i < barCount; i++) {
              if (normalizedPeaks[i] < 0.11) {
                if (silStart === null) silStart = i * barDur;
              } else if (silStart !== null) {
                const silEnd = i * barDur;
                if (silEnd - silStart >= 0.45) {
                  detectedSilences.push({
                    start: Number(silStart.toFixed(2)),
                    end: Number(silEnd.toFixed(2)),
                    duration: Number((silEnd - silStart).toFixed(2)),
                    label: `Dead Air (-${(silEnd - silStart).toFixed(1)}s)`
                  });
                }
                silStart = null;
              }
            }

            return buildAnalysisPayload(
              options.presetId || 'podcast-millionaire',
              Number(audioBuffer.duration.toFixed(2)),
              normalizedPeaks,
              detectedSilences.length > 0 ? detectedSilences : null
            );
          })
          .catch(() => fallbackPayload);

        // Attach fallback properties directly onto the Promise so synchronous readers still work
        Object.assign(asyncPromise, fallbackPayload);
        return asyncPromise;
      }

      return makeDualSyncAsyncResult(fallbackPayload);
    }

    /**
     * Helper: Checks if `timeSec` is inside a silence interval and returns the jump target timestamp
     * when `removeSilence` is active.
     */
    getSilenceJumpTarget(silences, timeSec) {
      if (!Array.isArray(silences)) return null;
      for (let i = 0; i < silences.length; i++) {
        const s = silences[i];
        if (timeSec >= s.start && timeSec < s.end - 0.02) {
          return s.end;
        }
      }
      return null;
    }

    /**
     * Helper: Returns the active word and surrounding 3-4 word karaoke phrase chunk at `timeSec`
     */
    getCaptionStateAtTime(analysisOrMoment, timeSec, wordsPerChunk = 4) {
      if (!analysisOrMoment) {
        if (typeof window !== 'undefined' && window.WhopState && window.WhopState.analysis) {
          analysisOrMoment = window.WhopState.analysis;
        } else {
          return null;
        }
      }
      let words = [];
      if (Array.isArray(analysisOrMoment.transcript) && analysisOrMoment.transcript.length > 0) {
        words = analysisOrMoment.transcript;
      } else if (Array.isArray(analysisOrMoment.words) && analysisOrMoment.words.length > 0) {
        words = analysisOrMoment.words;
      } else if (
        Array.isArray(analysisOrMoment.viralMoments) &&
        analysisOrMoment.viralMoments.length > 0
      ) {
        const topMom = analysisOrMoment.viralMoments[0];
        if (Array.isArray(topMom.transcript) && topMom.transcript.length > 0) {
          words = topMom.transcript;
        } else if (Array.isArray(topMom.words) && topMom.words.length > 0) {
          words = topMom.words;
        } else {
          analysisOrMoment.viralMoments.forEach((m) => {
            if (Array.isArray(m.transcript)) words.push(...m.transcript);
            else if (Array.isArray(m.words)) words.push(...m.words);
          });
        }
      }
      if (words.length === 0 && typeof window !== 'undefined' && window.WhopState) {
        const st = window.WhopState;
        if (st.analysis && Array.isArray(st.analysis.transcript) && st.analysis.transcript.length > 0) {
          words = st.analysis.transcript;
        } else if (st.analysis && Array.isArray(st.analysis.viralMoments) && st.analysis.viralMoments.length > 0) {
          const m0 = st.analysis.viralMoments[0];
          if (Array.isArray(m0.transcript) && m0.transcript.length > 0) words = m0.transcript;
          else if (Array.isArray(m0.words) && m0.words.length > 0) words = m0.words;
        }
      }
      if (words.length === 0) return null;

      // Match either absolute `start..end`, clip-relative `relStart..relEnd`, or time-shifted
      const firstW = words[0];
      const firstStart = typeof firstW.start === 'number' ? firstW.start : 0;

      let activeIdx = words.findIndex((w) => timeSec >= w.start && timeSec <= w.end + 0.08);
      if (activeIdx === -1) {
        activeIdx = words.findIndex(
          (w) =>
            typeof w.relStart === 'number' &&
            timeSec >= w.relStart &&
            timeSec <= w.relEnd + 0.08
        );
      }
      if (activeIdx === -1 && firstStart > 20.0 && timeSec < 60.0) {
        const shiftedTime = timeSec + firstStart;
        activeIdx = words.findIndex((w) => shiftedTime >= w.start && shiftedTime <= w.end + 0.08);
      }
      if (activeIdx === -1) {
        // Find nearest word prior to timeSec
        for (let i = words.length - 1; i >= 0; i--) {
          const wSt = typeof words[i].relStart === 'number' ? words[i].relStart : words[i].start;
          if (timeSec >= wSt) {
            activeIdx = i;
            break;
          }
        }
      }
      if (activeIdx === -1) activeIdx = 0;

      const chunkStart = Math.floor(activeIdx / wordsPerChunk) * wordsPerChunk;
      const chunkWords = words.slice(chunkStart, chunkStart + wordsPerChunk);
      const activeWord = words[activeIdx];

      return {
        activeWord,
        activeIndexInChunk: activeIdx - chunkStart,
        chunkWords
      };
    }
  }

  // Create a default singleton instance and attach static-delegating methods on WhopAudioEngine
  // so both `new window.WhopAudioEngine()` AND `window.WhopAudioEngine.analyzeVideoBufferOrDemo(...)` work.
  const defaultInstance = new WhopAudioEngine();

  WhopAudioEngine.MUSIC_PRESETS = MUSIC_PRESETS;
  WhopAudioEngine.DEMO_SCRIPTS = DEMO_SCRIPTS;
  WhopAudioEngine.instance = defaultInstance;
  WhopAudioEngine.create = function () {
    return new WhopAudioEngine();
  };

  [
    'init',
    'resume',
    'connectMainVideo',
    'connectBrollVideo',
    'connectVideos',
    'getExportAudioStream',
    'getAudioStream',
    'getDestinationStream',
    'setVolumes',
    'setMainVolume',
    'setBrollVolume',
    'setMusicVolume',
    'setMasterVolume',
    'setMusicPreset',
    'setMusicBed',
    'startMusic',
    'stopMusic',
    'syncPlayback',
    'playSfx',
    'triggerSfx',
    'getCurrentLevel',
    'analyzeVideoBufferOrDemo',
    'getSilenceJumpTarget',
    'getCaptionStateAtTime'
  ].forEach((methodName) => {
    WhopAudioEngine[methodName] = function (...args) {
      return defaultInstance[methodName](...args);
    };
  });

  global.WhopAudioEngine = WhopAudioEngine;
})(typeof window !== 'undefined' ? window : globalThis);
