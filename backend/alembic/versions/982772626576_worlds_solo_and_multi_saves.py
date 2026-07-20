"""worlds: solo and multi saves

Splits the single global scene into per-save worlds. Everyone already playing
is together in one shared scene, so they're all migrated into a single multi
world with a join code — nobody loses a career, songs, covers or takes, and
friends who were competing on the same chart still are.

`characters.user_id` loses its UNIQUE: a player now holds one career per world.
SQLite can't drop a constraint in place, so the table is rebuilt via
batch_alter_table (works on Postgres too).

Revision ID: 982772626576
Revises: 3fa3368e669d
Create Date: 2026-07-21 00:25:23.273881

"""
import uuid
from datetime import date, datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '982772626576'
down_revision: Union[str, None] = '3fa3368e669d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LEGACY_WORLD_NAME = "공용 월드"
LEGACY_JOIN_CODE = "ORIGIN"
# NPC songs seeded before worlds existed have no in-game release date; dating
# them at the shared epoch puts them in every career's back catalogue.
GAME_EPOCH = date(2026, 1, 1)


def _find_unique(bind, table: str, columns: list[str]) -> str | None:
    """Name of the unique constraint over exactly these columns, if any.

    Looked up rather than hardcoded because the original was unnamed: Postgres
    generated `characters_user_id_key`, SQLite made an anonymous autoindex.
    """
    for uc in sa.inspect(bind).get_unique_constraints(table):
        if list(uc.get("column_names") or []) == columns:
            return uc.get("name")
    return None


def _characters_without_old_unique() -> sa.Table:
    """The characters table as it should look, minus the unique(user_id).

    SQLite's batch mode rebuilds the table from a definition; passing this as
    `copy_from` is the documented way to shed a constraint it can't name.
    Mirrors models/character.py — keep the two in step.
    """
    meta = sa.MetaData()
    return sa.Table(
        "characters", meta,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("world_id", sa.String(36), nullable=True),
        sa.Column("artist_name", sa.String(120), nullable=False),
        sa.Column("background_id", sa.String(40), nullable=False),
        sa.Column("background_name", sa.String(120), nullable=False),
        sa.Column("stats", sa.JSON(), nullable=False),
        sa.Column("talent", sa.JSON(), nullable=False),
        sa.Column("fame", sa.Numeric(), nullable=False),
        sa.Column("money", sa.Numeric(), nullable=False),
        sa.Column("fans_count", sa.Integer(), nullable=False),
        sa.Column("total_streams", sa.Integer(), nullable=False),
        sa.Column("game_date", sa.Date(), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("last_settled_week", sa.Integer(), nullable=False),
        sa.Column("last_settled_season", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        'worlds',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('owner_user_id', sa.String(length=36), nullable=False),
        sa.Column('join_code', sa.String(length=12), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_worlds_owner_user_id'), 'worlds', ['owner_user_id'], unique=False)
    op.create_index(op.f('ix_worlds_join_code'), 'worlds', ['join_code'], unique=True)

    bind = op.get_bind()

    # Everyone currently playing shares one scene — keep them together.
    existing_user = bind.execute(sa.text("SELECT id FROM users ORDER BY created_at LIMIT 1")).fetchone()
    legacy_world_id = None
    if existing_user is not None:
        legacy_world_id = str(uuid.uuid4())
        bind.execute(
            sa.text("INSERT INTO worlds (id, name, kind, owner_user_id, join_code, created_at) "
                    "VALUES (:id, :name, 'multi', :owner, :code, :now)"),
            {"id": legacy_world_id, "name": LEGACY_WORLD_NAME, "owner": existing_user[0],
             "code": LEGACY_JOIN_CODE, "now": datetime.now(timezone.utc)},
        )

    # --- characters: add world_id, swap unique(user_id) for (user_id, world_id)
    op.add_column('characters', sa.Column('world_id', sa.String(length=36), nullable=True))
    if legacy_world_id:
        bind.execute(sa.text("UPDATE characters SET world_id = :w"), {"w": legacy_world_id})

    # The old constraint was declared as an unnamed sa.UniqueConstraint('user_id'),
    # so it has a generated name on Postgres and none at all on SQLite. Postgres
    # can drop it by that name; SQLite has to rebuild the table, and batch mode
    # only leaves it behind if we hand it a definition that omits it — hence
    # copy_from below.
    old_unique = _find_unique(bind, "characters", ["user_id"])

    if bind.dialect.name == "postgresql" and old_unique:
        op.drop_constraint(old_unique, "characters", type_="unique")
        with op.batch_alter_table('characters', schema=None) as batch:
            batch.alter_column('world_id', existing_type=sa.String(length=36), nullable=False)
            batch.create_unique_constraint('uq_character_user_world', ['user_id', 'world_id'])
            batch.create_index(batch.f('ix_characters_user_id'), ['user_id'], unique=False)
            batch.create_index(batch.f('ix_characters_world_id'), ['world_id'], unique=False)
            batch.create_foreign_key('fk_characters_world', 'worlds', ['world_id'], ['id'])
    else:
        with op.batch_alter_table('characters', schema=None,
                                  copy_from=_characters_without_old_unique()) as batch:
            batch.alter_column('world_id', existing_type=sa.String(length=36), nullable=False)
            batch.create_unique_constraint('uq_character_user_world', ['user_id', 'world_id'])
            batch.create_index(batch.f('ix_characters_user_id'), ['user_id'], unique=False)
            batch.create_index(batch.f('ix_characters_world_id'), ['world_id'], unique=False)
            batch.create_foreign_key('fk_characters_world', 'worlds', ['world_id'], ['id'])

    # --- npc_songs: per-world discography with in-game release dates
    op.add_column('npc_songs', sa.Column('world_id', sa.String(length=36), nullable=True))
    op.add_column('npc_songs', sa.Column('released_on', sa.Date(), nullable=True))
    if legacy_world_id:
        bind.execute(sa.text("UPDATE npc_songs SET world_id = :w, released_on = :d"),
                     {"w": legacy_world_id, "d": GAME_EPOCH})
    else:
        # No users yet, so any seeded NPC songs belong to no world and would
        # violate NOT NULL — they'll be regenerated per world on demand.
        bind.execute(sa.text("DELETE FROM npc_songs"))

    with op.batch_alter_table('npc_songs', schema=None) as batch:
        batch.alter_column('world_id', existing_type=sa.String(length=36), nullable=False)
        batch.alter_column('released_on', existing_type=sa.Date(), nullable=False)
        batch.create_index(batch.f('ix_npc_songs_world_id'), ['world_id'], unique=False)
        batch.create_foreign_key('fk_npc_songs_world', 'worlds', ['world_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('npc_songs', schema=None) as batch:
        batch.drop_constraint('fk_npc_songs_world', type_='foreignkey')
        batch.drop_index(batch.f('ix_npc_songs_world_id'))
    op.drop_column('npc_songs', 'released_on')
    op.drop_column('npc_songs', 'world_id')

    # Going back to one career per account: keep the oldest per user so the
    # restored unique constraint can hold.
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM characters WHERE id NOT IN ("
        "  SELECT id FROM ("
        "    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) rn FROM characters"
        "  ) t WHERE rn = 1)"
    ))

    with op.batch_alter_table('characters', schema=None) as batch:
        batch.drop_constraint('fk_characters_world', type_='foreignkey')
        batch.drop_constraint('uq_character_user_world', type_='unique')
        batch.drop_index(batch.f('ix_characters_world_id'))
        batch.drop_index(batch.f('ix_characters_user_id'))
        batch.create_unique_constraint('uq_character_user', ['user_id'])
    op.drop_column('characters', 'world_id')

    op.drop_index(op.f('ix_worlds_join_code'), table_name='worlds')
    op.drop_index(op.f('ix_worlds_owner_user_id'), table_name='worlds')
    op.drop_table('worlds')
