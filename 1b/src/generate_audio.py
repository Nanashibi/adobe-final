#!/usr/bin/env python3
"""
Sample TTS integration script for Adobe Hackathon
Supports multiple providers: Azure, GCP, local
"""

import os
import tempfile
from typing import Optional

def generate_audio(
    text: str,
    output_path: str,
    voice: Optional[str] = None,
    language: str = "en-US"
) -> bool:
    """
    Generate audio from text using environment variables for configuration
    
    Args:
        text: Text to convert to speech
        output_path: Path to save the audio file (.mp3)
        voice: Voice ID (optional, uses provider default)
        language: Language code
        
    Returns:
        True if successful, False otherwise
    """
    provider = os.getenv('TTS_PROVIDER', 'azure').lower()
    
    try:
        if provider == 'azure':
            return _generate_azure_tts(text, output_path, voice, language)
        elif provider == 'gcp':
            return _generate_gcp_tts(text, output_path, voice, language)
        elif provider == 'local':
            return _generate_local_tts(text, output_path, voice, language)
        else:
            raise ValueError(f"Unsupported TTS provider: {provider}")
    except Exception as e:
        print(f"TTS generation error: {e}")
        return False

def _generate_azure_tts(text: str, output_path: str, voice: Optional[str], language: str) -> bool:
    """Generate audio using Azure TTS"""
    try:
        import azure.cognitiveservices.speech as speechsdk
        
        # Configure Azure Speech
        speech_key = os.getenv('AZURE_TTS_KEY')
        service_region = os.getenv('AZURE_TTS_REGION', 'eastus')
        endpoint = os.getenv('AZURE_TTS_ENDPOINT')
        
        if not speech_key:
            raise Exception("AZURE_TTS_KEY not provided")
        
        # Create speech config
        if endpoint:
            speech_config = speechsdk.SpeechConfig(subscription=speech_key, endpoint=endpoint)
        else:
            speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=service_region)
        
        # Set voice
        voice_name = voice or "en-US-AriaNeural"
        speech_config.speech_synthesis_voice_name = voice_name
        
        # Set output format
        speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3)
        
        # Create synthesizer
        audio_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
        
        # Generate speech
        result = synthesizer.speak_text_async(text).get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return True
        else:
            print(f"Azure TTS failed: {result.reason}")
            return False
            
    except ImportError:
        raise Exception("azure-cognitiveservices-speech package not installed")
    except Exception as e:
        raise Exception(f"Azure TTS error: {e}")

def _generate_gcp_tts(text: str, output_path: str, voice: Optional[str], language: str) -> bool:
    """Generate audio using Google Cloud TTS"""
    try:
        from google.cloud import texttospeech
        
        # Configure credentials
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if credentials_path:
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
        
        # Create client
        client = texttospeech.TextToSpeechClient()
        
        # Set up synthesis input
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # Set voice parameters
        voice_name = voice or "en-US-Wavenet-D"
        voice_config = texttospeech.VoiceSelectionParams(
            language_code=language,
            name=voice_name
        )
        
        # Set audio config
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )
        
        # Generate speech
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice_config,
            audio_config=audio_config
        )
        
        # Save to file
        with open(output_path, "wb") as out:
            out.write(response.audio_content)
        
        return True
        
    except ImportError:
        raise Exception("google-cloud-texttospeech package not installed")
    except Exception as e:
        raise Exception(f"GCP TTS error: {e}")

def _generate_local_tts(text: str, output_path: str, voice: Optional[str], language: str) -> bool:
    """Generate audio using local TTS (espeak/festival)"""
    try:
        import subprocess
        import os
        
        # Try espeak first
        try:
            # Generate wav first, then convert to mp3
            wav_path = output_path.replace('.mp3', '.wav')
            
            cmd = ['espeak', '-s', '150', '-v', language, '-w', wav_path, text]
            subprocess.run(cmd, check=True, capture_output=True)
            
            # Convert to mp3 if ffmpeg is available
            try:
                subprocess.run(['ffmpeg', '-i', wav_path, '-acodec', 'mp3', output_path], 
                             check=True, capture_output=True)
                os.remove(wav_path)  # Clean up wav file
            except (subprocess.CalledProcessError, FileNotFoundError):
                # If ffmpeg not available, just rename wav to mp3
                os.rename(wav_path, output_path)
            
            return True
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        # Try festival as fallback
        try:
            # Create a temporary text file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(text)
                temp_txt = f.name
            
            wav_path = output_path.replace('.mp3', '.wav')
            cmd = ['text2wave', temp_txt, '-o', wav_path]
            subprocess.run(cmd, check=True, capture_output=True)
            
            # Convert to mp3 if possible
            try:
                subprocess.run(['ffmpeg', '-i', wav_path, '-acodec', 'mp3', output_path], 
                             check=True, capture_output=True)
                os.remove(wav_path)
            except (subprocess.CalledProcessError, FileNotFoundError):
                os.rename(wav_path, output_path)
            
            os.remove(temp_txt)  # Clean up
            return True
            
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        raise Exception("No local TTS engine found (espeak or festival)")
        
    except Exception as e:
        raise Exception(f"Local TTS error: {e}")

def generate_podcast_audio(
    script_sections: list,
    output_path: str,
    voice_mapping: Optional[dict] = None
) -> bool:
    """
    Generate multi-speaker podcast audio
    
    Args:
        script_sections: List of {"speaker": str, "content": str} dicts
        output_path: Path to save final audio
        voice_mapping: Optional mapping of speaker names to voice IDs
        
    Returns:
        True if successful
    """
    try:
        import subprocess
        import tempfile
        import os
        
        voice_mapping = voice_mapping or {
            "Host": "en-US-AriaNeural",
            "Expert": "en-US-GuyNeural",
            "Narrator": "en-US-JennyNeural"
        }
        
        temp_files = []
        
        # Generate audio for each section
        for i, section in enumerate(script_sections):
            speaker = section.get("speaker", "Host")
            content = section.get("content", "")
            
            if not content.strip():
                continue
            
            temp_path = f"{output_path}.part_{i}.mp3"
            voice = voice_mapping.get(speaker, voice_mapping.get("Host", None))
            
            if generate_audio(content, temp_path, voice=voice):
                temp_files.append(temp_path)
        
        if not temp_files:
            return False
        
        # Concatenate all audio files
        if len(temp_files) == 1:
            os.rename(temp_files[0], output_path)
        else:
            # Use ffmpeg to concatenate
            try:
                # Create concat file list
                concat_file = f"{output_path}.concat.txt"
                with open(concat_file, 'w') as f:
                    for temp_file in temp_files:
                        f.write(f"file '{temp_file}'\n")
                
                # Concatenate with ffmpeg
                cmd = ['ffmpeg', '-f', 'concat', '-safe', '0', '-i', concat_file, '-c', 'copy', output_path]
                subprocess.run(cmd, check=True, capture_output=True)
                
                # Clean up
                os.remove(concat_file)
                
            except (subprocess.CalledProcessError, FileNotFoundError):
                # Fallback: just use the first file
                os.rename(temp_files[0], output_path)
        
        # Clean up temp files
        for temp_file in temp_files:
            if os.path.exists(temp_file) and temp_file != output_path:
                os.remove(temp_file)
        
        return True
        
    except Exception as e:
        print(f"Podcast generation error: {e}")
        return False

if __name__ == "__main__":
    import sys
    import json
    
    try:
        # Read JSON input from stdin
        input_data = json.loads(sys.stdin.read())
        text = input_data.get('text', '')
        output_path = input_data.get('output_path', '')
        voice = input_data.get('voice')
        language = input_data.get('language', 'en-US')
        
        if not text or not output_path:
            print("Error: Text and output_path are required", file=sys.stderr)
            sys.exit(1)
        
        success = generate_audio(text, output_path, voice, language)
        
        if success:
            print(f"Audio generated: {output_path}")
            sys.exit(0)
        else:
            print("Audio generation failed", file=sys.stderr)
            sys.exit(1)
            
    except json.JSONDecodeError:
        print("Error: Invalid JSON input", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
