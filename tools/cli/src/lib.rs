use clap::{Parser, Subcommand};

pub mod utils;
mod release;

#[derive(Parser)]
#[command(version)]
#[command(about = "MarkFlowy Development Tool")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Release(release::Release),
}

pub fn run() {
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::Release(name)) => {
          release::main(name.major, name.minor, name.patch);
        },
        None => {}
    }
}
