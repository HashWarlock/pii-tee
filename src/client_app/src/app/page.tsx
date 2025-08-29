import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { Shield, MessageCircle, Lock, Zap } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-12">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold">PII-TEE Anonymous Chat</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Secure, privacy-preserving conversations with AI using Trusted Execution Environment
            </p>
          </div>
          <ThemeToggle />
        </header>

        <main className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Getting Started
              </CardTitle>
              <CardDescription>
                Experience secure AI conversations with automatic PII protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Write Message</h3>
                    <p className="text-sm text-muted-foreground">
                      Type your message containing any personal information
                    </p>
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Shield className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Auto Anonymize</h3>
                    <p className="text-sm text-muted-foreground">
                      PII data is automatically detected and anonymized
                    </p>
                  </div>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Chat Safely</h3>
                    <p className="text-sm text-muted-foreground">
                      AI responds to anonymized content with TEE attestation
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <Link href="/chat">
              <Button size="lg" className="px-8">
                Start Anonymous Chat
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-2">
              <Badge variant="secondary">Three-Panel Chat Interface</Badge>
              <Badge variant="outline">TEE Verification Ready</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Experience secure AI conversations with automatic PII protection
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
