FROM python:3.11-slim

# HF Spaces runs as a non-root user (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/user/.cache/huggingface/transformers \
    SENTENCE_TRANSFORMERS_HOME=/home/user/.cache/sentence_transformers

WORKDIR /home/user/app

# Install dependencies first (layer cache)
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY --chown=user . .

RUN python -c "\
    from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('all-MiniLM-L6-v2'); \
    from transformers import GPT2LMHeadModel, GPT2TokenizerFast; \
    GPT2TokenizerFast.from_pretrained('gpt2'); \
    GPT2LMHeadModel.from_pretrained('gpt2'); \
    GPT2TokenizerFast.from_pretrained('distilgpt2'); \
    GPT2LMHeadModel.from_pretrained('distilgpt2'); \
    print('Models cached OK')"

# HF Spaces exposes port 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]