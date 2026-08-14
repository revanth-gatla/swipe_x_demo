import psycopg2


def get_db_connection():
    connection = psycopg2.connect(
        host="localhost",
        port=5432,
        database="swipe_x",
        user="postgres",
        password="revanth@1030"
    )

    return connection