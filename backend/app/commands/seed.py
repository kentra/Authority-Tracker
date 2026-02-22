# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals
"""
Seed database with sample data.

This command is useful for development and testing.
Uses random data generation - install faker for better data:
    uv add faker --group dev
"""

import random
import string

import click


from app.commands import command, info, warning

# Try to import Faker for better data generation
try:
    from faker import Faker

    fake = Faker()
    HAS_FAKER = True
except ImportError:
    HAS_FAKER = False
    fake = None


def random_email() -> str:
    """Generate a random email address."""
    if HAS_FAKER:
        return fake.email()
    random_str = "".join(random.choices(string.ascii_lowercase, k=8))
    return f"{random_str}@example.com"


def random_name() -> str:
    """Generate a random full name."""
    if HAS_FAKER:
        return fake.name()
    first_names = ["John", "Jane", "Bob", "Alice", "Charlie", "Diana", "Eve", "Frank"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def random_title() -> str:
    """Generate a random item title."""
    if HAS_FAKER:
        return fake.sentence(nb_words=4).rstrip(".")
    adjectives = ["Amazing", "Great", "Awesome", "Fantastic", "Incredible", "Beautiful"]
    nouns = ["Widget", "Gadget", "Thing", "Product", "Item", "Object"]
    return f"{random.choice(adjectives)} {random.choice(nouns)}"


def random_description() -> str:
    """Generate a random description."""
    if HAS_FAKER:
        return fake.paragraph(nb_sentences=3)
    return "This is a sample description for development purposes."


@command("seed", help="Seed database with sample data")
@click.option("--count", "-c", default=10, type=int, help="Number of records to create")
@click.option("--clear", is_flag=True, help="Clear existing data before seeding")
@click.option("--dry-run", is_flag=True, help="Show what would be created without making changes")
def seed(
    count: int,
    clear: bool,
    dry_run: bool,
) -> None:
    """
    Seed the database with sample data for development.

    Example:
        project cmd seed --count 50
        project cmd seed --clear --count 100
        project cmd seed --dry-run
    """
    if not HAS_FAKER:
        warning(
            "Faker not installed. Using basic random data. For better data: uv add faker --group dev"
        )

    if dry_run:
        info(f"[DRY RUN] Would create {count} sample records per entity")
        if clear:
            info("[DRY RUN] Would clear existing data first")
        return
    info("No entities configured to seed. Enable JWT users or example CRUD to use this command.")
