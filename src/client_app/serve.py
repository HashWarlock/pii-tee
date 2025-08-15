import configargparse
from textual_serve.server import Server
import logging


def main():
    parser = configargparse.ArgParser()
    parser.add_argument("--host", type=str, default="localhost", env_var='TEXTUAL_HOST')
    parser.add_argument("--port", type=int, default=8000, env_var='TEXTUAL_PORT')
    parser.add_argument("--public_url", type=str, default=None, env_var='TEXTUAL_PUBLIC_URL')
    parser.add_argument("--debug", action="store_true", env_var='TEXTUAL_DEBUG')
    args = parser.parse_args()

    # Configure logging
    if args.debug:
        logging.basicConfig(level=logging.DEBUG)
    
    # Create server with better configuration
    server = Server(
        "python client.py --mode llm", 
        host=args.host, 
        port=args.port, 
        public_url=args.public_url
    )
    
    try:
        server.serve()
    except KeyboardInterrupt:
        print("Server stopped by user")
    except Exception as e:
        print(f"Server error: {e}")
        if args.debug:
            raise


if __name__ == "__main__":
    main()
