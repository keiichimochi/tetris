import streamlit as st
import yt_dlp
import tempfile
import os

def download_mp3(youtube_url, download_dir=None):
    # ダウンロード先のディレクトリを設定
    if download_dir:
        output_template = os.path.join(download_dir, '%(title)s.%(ext)s')
    else:
        temp_dir = tempfile.gettempdir()
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': output_template,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            mp3_file = os.path.join(download_dir or temp_dir, f"{info['title']}.mp3")
            
            with open(mp3_file, 'rb') as f:
                data = f.read()
            
            # 一時ファイルの場合のみ削除
            if not download_dir:
                os.remove(mp3_file)
            return data, info['title'], mp3_file if download_dir else None
    except Exception as e:
        raise Exception(f"ダウンロードエラー: {str(e)}")

st.title('YouTube MP3 ダウンローダー')

youtube_url = st.text_input('YouTubeのURLを入力してください:')
download_dir = st.text_input('保存先フォルダのパスを入力してください（空白の場合は一時フォルダに保存）:')

if st.button('ダウンロード'):
    if youtube_url:
        try:
            # 指定されたダウンロードディレクトリが存在するか確認
            if download_dir and not os.path.exists(download_dir):
                st.error('指定されたフォルダが存在しません。')
            else:
                mp3_data, title, saved_path = download_mp3(youtube_url, download_dir if download_dir else None)
                if saved_path:
                    st.success(f'"{title}" を {saved_path} に保存しました!')
                else:
                    st.success(f'"{title}" のダウンロードが完了しました!')
                st.audio(mp3_data, format='audio/mp3')
        except Exception as e:
            st.error(f'エラーが発生しました: {e}')
    else:
        st.warning('URLを入力してください。')
