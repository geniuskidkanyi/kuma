//! Microphone capture via `cpal`. Records to a temporary WAV file which is
//! then fed through the normal ffmpeg decode + transcribe pipeline.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;
use tauri::{AppHandle, Emitter};

/// Live recorder handle stored in Tauri managed state.
pub struct Recorder {
    stop_tx: Sender<()>,
    handle: JoinHandle<anyhow::Result<String>>,
}

#[derive(Default)]
pub struct RecorderState(pub Mutex<Option<Recorder>>);

fn temp_wav_path() -> std::path::PathBuf {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("mywhisper-rec-{ts}.wav"))
}

pub fn start(app: &AppHandle, state: &RecorderState) -> anyhow::Result<()> {
    let mut guard = state.0.lock().unwrap();
    if guard.is_some() {
        anyhow::bail!("already recording");
    }

    let (stop_tx, stop_rx) = channel::<()>();
    let app = app.clone();

    let handle = std::thread::spawn(move || -> anyhow::Result<String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| anyhow::anyhow!("no input (microphone) device found"))?;
        let config = device.default_input_config()?;
        let sample_rate = config.sample_rate();
        let channels = config.channels();
        let sample_format = config.sample_format();

        let samples: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let frame_counter = Arc::new(AtomicU64::new(0));

        // Shared closure that ingests a chunk of f32 samples.
        let ingest = {
            let samples = samples.clone();
            let counter = frame_counter.clone();
            let app = app.clone();
            move |data: &[f32]| {
                {
                    let mut buf = samples.lock().unwrap();
                    buf.extend_from_slice(data);
                }
                // RMS level meter, emitted roughly 10x/sec.
                let n = counter.fetch_add(1, Ordering::Relaxed);
                if n % 4 == 0 && !data.is_empty() {
                    let sum: f32 = data.iter().map(|s| s * s).sum();
                    let rms = (sum / data.len() as f32).sqrt();
                    let _ = app.emit("recording://level", rms);
                }
            }
        };

        let err_fn = |e| eprintln!("recording stream error: {e}");
        let stream_config: cpal::StreamConfig = config.into();

        // Build a stream matching the device's native sample format,
        // normalising everything to f32 in [-1, 1].
        let stream = match sample_format {
            SampleFormat::F32 => device.build_input_stream(
                &stream_config,
                move |data: &[f32], _| ingest(data),
                err_fn,
                None,
            )?,
            SampleFormat::I16 => device.build_input_stream(
                &stream_config,
                move |data: &[i16], _| {
                    let f: Vec<f32> = data.iter().map(|s| *s as f32 / 32768.0).collect();
                    ingest(&f);
                },
                err_fn,
                None,
            )?,
            SampleFormat::U16 => device.build_input_stream(
                &stream_config,
                move |data: &[u16], _| {
                    let f: Vec<f32> = data
                        .iter()
                        .map(|s| (*s as f32 - 32768.0) / 32768.0)
                        .collect();
                    ingest(&f);
                },
                err_fn,
                None,
            )?,
            other => anyhow::bail!("unsupported sample format: {other:?}"),
        };

        stream.play()?;

        // Block until asked to stop.
        let _ = stop_rx.recv();
        drop(stream);

        // Write the collected samples to a WAV file.
        let buf = samples.lock().unwrap();
        let spec = hound::WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };
        let path = temp_wav_path();
        let mut writer = hound::WavWriter::create(&path, spec)?;
        for &s in buf.iter() {
            writer.write_sample(s)?;
        }
        writer.finalize()?;

        Ok(path.to_string_lossy().to_string())
    });

    *guard = Some(Recorder { stop_tx, handle });
    Ok(())
}

pub fn stop(state: &RecorderState) -> anyhow::Result<String> {
    let recorder = state
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| anyhow::anyhow!("not recording"))?;
    // Signal the worker thread and wait for the WAV to be written.
    let _ = recorder.stop_tx.send(());
    recorder
        .handle
        .join()
        .map_err(|_| anyhow::anyhow!("recording thread panicked"))?
}
