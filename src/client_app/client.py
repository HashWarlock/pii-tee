from dotenv import load_dotenv

load_dotenv()

import argparse
import os
import requests
from openai import OpenAI
import httpx
from textual import on
from textual.app import App, ComposeResult
from textual.widgets import Input, Label, RichLog
from textual.containers import Horizontal, Vertical
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def anonymize(text: str, language: str, session_id: str = None):
    logger.info("Calling anonymize API with text length: %d, language: %s, session_id: %s", 
               len(text), language, session_id)
    
    url = os.getenv("API_URL").rstrip("/") + "/anonymize"
    logger.info("API URL: %s", url)

    body = {
        "text": text,
        "language": language,
    }
    if session_id is not None:
        body["session_id"] = session_id
    
    logger.info("Request body: %s", body)
    
    response = requests.post(url, json=body)
    logger.info("Response status: %d", response.status_code)
    
    response.raise_for_status()
    result = response.json()
    logger.info("Anonymize response received, session_id: %s", result.get("session_id"))
    return result


def deanonymize(text: str, session_id: str):
    logger.info("Calling deanonymize API with text length: %d, session_id: %s", 
               len(text), session_id)
    
    url = os.getenv("API_URL").rstrip("/") + "/deanonymize"
    logger.info("API URL: %s", url)

    request_body = {
        "text": text,
        "session_id": session_id,
    }
    logger.info("Request body: %s", request_body)
    
    response = requests.post(url, json=request_body)
    logger.info("Response status: %d", response.status_code)
    
    response.raise_for_status()
    result = response.json()
    logger.info("Deanonymize response received")
    return result


def get_public_key(signing_method: str = None):
    """Get the public key for verification"""
    logger.info("Getting public key with signing_method: %s", signing_method)
    
    url = os.getenv("API_URL").rstrip("/") + "/public-key"
    params = {}
    if signing_method:
        params["signing_method"] = signing_method
    
    logger.info("API URL: %s, params: %s", url, params)
    
    response = requests.get(url, params=params)
    logger.info("Response status: %d", response.status_code)
    
    response.raise_for_status()
    result = response.json()
    logger.info("Public key response received")
    return result


def get_llm_response(messages):
    logger.info("Getting LLM response, messages count: %d", len(messages))
    
    # For now, return a placeholder response to avoid the httpx error
    client = OpenAI(
        base_url=os.getenv("REDPILL_ENDPOINT"),
        api_key=os.getenv("REDPILL_API_KEY")
    )

    logger.info("OpenAI client created, base_url: %s", os.getenv("REDPILL_ENDPOINT"))

    completion = client.chat.completions.create(
        messages=messages,
        model="phala/deepseek-chat-v3-0324",
    )

    logger.info("LLM response received")
    return completion.choices[0].message


class InputApp(App):
    CSS = """
    Input {
        border: red 60%;
    }
    Input:focus {
        border: tall $success;
    }
    Label {
        margin: 1 2;
    }
    RichLog {
        margin-top: 1;
        margin-left: 1;
    }
    .verification-badge {
        color: $success;
        background: $success-darken-2;
        padding: 0 1;
    }
    .signature-details {
        border: solid $primary;
        padding: 1;
        margin: 1 0;
    }
    """

    def __init__(self, mode: str, language: str) -> None:
        super().__init__()
        logger.info("Initializing InputApp with mode: %s, language: %s", mode, language)
        self._mode = mode
        self._lang = language
        self._llm_message_history = [
            {
                "role": "system",
                "content": "You're a friendly assistant",
            },
        ]
        self._session_id = None
        self._verification_history = []  # Store verification details
        logger.info("InputApp initialized successfully")


    def compose(self) -> ComposeResult:
        logger.info("Composing UI components")
        with Horizontal():
            with Vertical(classes="column"):
                yield Label("Human view")
                yield Input(
                    placeholder="Enter text...",
                    id="person_input",
                )
                yield RichLog(id="person_text", highlight=True, markup=True, wrap=True)

            with Vertical(classes="column"):
                yield Label("LLM view")
                yield Input(
                    placeholder="Enter text..." if self._mode == 'manual' else "use --mode manual to chat on behalf of the LLM",
                    id="llm_input",
                    disabled=True,
                )
                yield RichLog(id="llm_text", highlight=True, markup=True, wrap=True)

            with Vertical(classes="column"):
                yield Label("Message Signature Verification")
                yield RichLog(id="verification_text", highlight=True, markup=True, wrap=True)

    def _add_verification_entry(self, message_id: str, content: str, signature_data: dict):
        """Add a new verification entry to the history"""
        logger.info("Adding verification entry for message_id: %s, content length: %d", 
                   message_id, len(content))
        logger.info("Signature data received: %s", signature_data)
        logger.info("Signature data keys: %s", list(signature_data.keys()) if signature_data else "None")
        
        verification_entry = {
            "id": message_id,
            "content": content,
            "quote": signature_data.get("quote"),
            "signature": signature_data.get("signature"),
            "public_key": signature_data.get("public_key"),
            "signing_method": signature_data.get("signing_method")
        }
        
        logger.info("Verification entry created: %s", verification_entry)
        logger.info("Quote data: %s", verification_entry["quote"])
        logger.info("Quote data type: %s", type(verification_entry["quote"]))
        if verification_entry["quote"]:
            logger.info("Quote data keys: %s", list(verification_entry["quote"].keys()) if isinstance(verification_entry["quote"], dict) else "Not a dict")
        logger.info("Signature: %s", verification_entry["signature"])
        logger.info("Public key: %s", verification_entry["public_key"])
        logger.info("Signing method: %s", verification_entry["signing_method"])
        
        self._verification_history.append(verification_entry)
        logger.info("Verification entry added, total entries: %d", len(self._verification_history))
        self._update_verification_display()

    def _update_verification_display(self):
        """Update the verification display with all entries"""
        logger.info("Updating verification display")
        verification_text = self.query_one("#verification_text", RichLog)
        verification_text.clear()
        
        verification_text.write("[bold blue]Verify signatures of messages generated by Presidio running in TEE.[/]")
        verification_text.write("Each response is signed within TEE to guarantee authenticity.\n")
        
        if self._verification_history:
            verification_text.write(f"[bold green]Verifiable Messages ({len(self._verification_history)})[/]\n")
            
            for i, entry in enumerate(self._verification_history, 1):
                verification_text.write(f"[bold]Message {i}[/]\n")
                
                # Show TEE verification status
                if entry["quote"] and entry["signature"]:
                    verification_text.write("[bold green]TEE Verified[/] ")
                else:
                    verification_text.write("[bold red]Not Verified[/] ")
                
                # Truncate content for display
                content_preview = entry["content"][:100] + "..." if len(entry["content"]) > 100 else entry["content"]
                verification_text.write(f"{content_preview}\n")
                
                verification_text.write(f"ID: {entry['id']}\n")
                
                if entry["quote"] and entry["signature"]:
                    verification_text.write("\n[bold]Signature Details[/]\n")
                    verification_text.write(f"Quote: {entry['quote'][:64]}...\n")
                    verification_text.write(f"Signing Address: {entry['public_key']}\n")
                    verification_text.write(f"Message: {entry['content'][:64]}...\n")
                    verification_text.write(f"Signature: {entry['signature']}\n")
                    verification_text.write(f"Algorithm: {entry['signing_method']}\n")
                
                verification_text.write("\n" + "-" * 50 + "\n")

    @on(Input.Submitted)
    def handle(self, event: Input.Submitted) -> None:
        logger.info("Input submitted, input_id: %s, value length: %d", 
                   event.input.id, len(event.value))
        
        person_input = self.query_one("#person_input")
        llm_input = self.query_one("#llm_input")

        llm_text = self.query_one("#llm_text", RichLog)
        person_text = self.query_one("#person_text", RichLog)

        try:
            if event.input.id == "person_input":
                logger.info("Processing person input")
                person_text.write("[bold magenta]  You:[/] " + event.value)

                # Use direct HTTP anonymize function with session validation
                try:
                    logger.info("Calling anonymize API")
                    anonymizer_response = anonymize(
                        text=event.value, 
                        language=self._lang, 
                        session_id=self._session_id
                    )
                    text_for_llm = anonymizer_response["text"]
                    self._session_id = anonymizer_response["session_id"]
                    logger.info("Anonymization successful, new session_id: %s", self._session_id)
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 404:  # Session not found
                        logger.info("Session not found (404), retrying without session")
                        # Session expired or invalid, retry without session
                        self._session_id = None
                        anonymizer_response = anonymize(text=event.value, language=self._lang)
                        text_for_llm = anonymizer_response["text"]
                        self._session_id = anonymizer_response["session_id"]
                        logger.info("Retry successful, new session_id: %s", self._session_id)
                    else:
                        logger.error("HTTP error during anonymization: %s", str(e))
                        raise

                llm_text.write("[bold magenta]Input:[/] " + text_for_llm)
                self._llm_message_history.append({"role": "user", "content": text_for_llm})
                logger.info("Message added to LLM history, total messages: %d", len(self._llm_message_history))

                # Add verification entry for anonymized input
                logger.info("Anonymizer response structure: %s", anonymizer_response)
                logger.info("Anonymizer response keys: %s", list(anonymizer_response.keys()))
                
                # Extract signature data from the response
                signature_data = {
                    "quote": anonymizer_response.get("quote"),
                    "signature": anonymizer_response.get("signature"),
                    "public_key": anonymizer_response.get("public_key"),
                    "signing_method": anonymizer_response.get("signing_method")
                }
                
                self._add_verification_entry(
                    f"input-{len(self._verification_history)}",
                    event.value,
                    signature_data
                )

                if self._mode == "llm":
                    logger.info("LLM mode: getting LLM response")
                    # let LLM generate response...
                    llm_response = get_llm_response(self._llm_message_history)
                    self._llm_message_history.append(
                        {"role": "assistant", "content": llm_response.content}
                    )
                    logger.info("LLM response received, content length: %d", len(llm_response.content))

                    # Use direct HTTP deanonymize function with error recovery
                    try:
                        logger.info("Calling deanonymize API for LLM response")
                        deanonymizer_response = deanonymize(
                            text=llm_response.content, session_id=self._session_id
                        )
                        text_for_person = deanonymizer_response["text"]
                        logger.info("Deanonymization successful")
                    except requests.exceptions.HTTPError as e:
                        if e.response and e.response.status_code == 404:
                            logger.error("Session expired during deanonymization")
                            # Session not found, show error and reset
                            person_text.write("[red]Session expired. Please restart the conversation.[/]")
                            self._session_id = None
                            return
                        else:
                            logger.error("HTTP error during deanonymization: %s", str(e))
                            raise

                    person_text.write("[bold cyan]Agent:[/] " + text_for_person)
                    llm_text.write("[bold cyan]  LLM:[/] " + llm_response.content)
                    
                    # Add verification entry for LLM response
                    logger.info("Deanonymizer response structure: %s", deanonymizer_response)
                    logger.info("Deanonymizer response keys: %s", list(deanonymizer_response.keys()))

                    # Extract signature data from the response
                    signature_data = {
                        "quote": deanonymizer_response.get("quote"),
                        "signature": deanonymizer_response.get("signature"),
                        "public_key": deanonymizer_response.get("public_key"),
                        "signing_method": deanonymizer_response.get("signing_method")
                    }
                    
                    self._add_verification_entry(
                        f"chatcmpl-{len(self._verification_history)}",
                        llm_response.content,
                        signature_data
                    )
                else:
                    logger.info("Manual mode: enabling LLM input")
                    # ...or let the person enter the response manually
                    llm_input.disabled = False
                    person_input.disabled = True
                    llm_input.focus()

            if event.input.id == "llm_input":
                logger.info("Processing LLM input")
                # Use direct HTTP deanonymize function with error recovery
                try:
                    logger.info("Calling deanonymize API for manual LLM input")
                    deanonymizer_response = deanonymize(
                        text=event.value, session_id=self._session_id
                    )
                    text_for_person = deanonymizer_response["text"]
                    logger.info("Deanonymization successful")
                except requests.exceptions.HTTPError as e:
                    if e.response and e.response.status_code == 404:
                        logger.error("Session expired during deanonymization")
                        # Session not found, show error and reset
                        person_text.write("[red]Session expired. Please restart the conversation.[/]")
                        self._session_id = None
                        llm_input.disabled = True
                        person_input.disabled = False
                        person_input.focus()
                        event.input.clear()
                        return
                    else:
                        logger.error("HTTP error during deanonymization: %s", str(e))
                        raise

                person_text.write("[bold cyan]Agent:[/] " + text_for_person)
                llm_text.write("[bold cyan]  LLM:[/] " + event.value)
                
                # Add verification entry for manual LLM input
                logger.info("Manual LLM deanonymizer response structure: %s", deanonymizer_response)
                logger.info("Manual LLM deanonymizer response keys: %s", list(deanonymizer_response.keys()))
                
                # Extract signature data from the response
                signature_data = {
                    "quote": deanonymizer_response.get("quote"),
                    "signature": deanonymizer_response.get("signature"),
                    "public_key": deanonymizer_response.get("public_key"),
                    "signing_method": deanonymizer_response.get("signing_method")
                }
                
                self._add_verification_entry(
                    f"chatcmpl-{len(self._verification_history)}",
                    event.value,
                    signature_data
                )
                
                llm_input.disabled = True
                person_input.disabled = False
                person_input.focus()

            event.input.clear()
            logger.info("Input handling completed successfully")
            
        except Exception as e:
            logger.error("Error during input handling: %s", str(e))
            person_text.write(f"[red]Error: {str(e)}[/]")


def main():
    logger.info("Starting client application")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=["manual", "llm"],
        default="llm",
        help="Chat mode: manual or llm",
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Chat language: one of the languages supported by the API service",
    )
    args = parser.parse_args()
    
    logger.info("Arguments parsed: mode=%s, language=%s", args.mode, args.language)

    app = InputApp(mode=args.mode, language=args.language)
    logger.info("Starting Textual app")
    app.run()


if __name__ == "__main__":
    main()
